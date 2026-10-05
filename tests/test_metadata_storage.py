"""Offline storage tests: no ComfyUI installation, GPU, or network required."""

import asyncio
import builtins
import importlib
import json
import sys
import types
from pathlib import Path

import pytest


@pytest.fixture
def storage(tmp_path, monkeypatch):
  # Import only the backend helpers, not the node package's ComfyUI entrypoint.
  package = types.ModuleType('rgthree_storage_test')
  package.__path__ = [str(Path(__file__).resolve().parents[1] / 'py')]
  monkeypatch.setitem(sys.modules, package.__name__, package)
  server_package = types.ModuleType('rgthree_storage_test.server')
  server_package.__path__ = [str(Path(package.__path__[0]) / 'server')]
  monkeypatch.setitem(sys.modules, server_package.__name__, server_package)
  paths = types.ModuleType('folder_paths')
  models = {}
  paths.get_full_path = lambda category, name: models.get((category, name))
  monkeypatch.setitem(sys.modules, 'folder_paths', paths)
  server = types.ModuleType('server')
  events = []

  async def send(event, data):
    events.append((event, data))

  server.PromptServer = types.SimpleNamespace(instance=types.SimpleNamespace(send=send))
  monkeypatch.setitem(sys.modules, 'server', server)
  info = importlib.import_module('rgthree_storage_test.server.utils_info')
  monkeypatch.setattr(info, 'folder_paths', paths)
  monkeypatch.setattr(info, 'PromptServer', server.PromptServer)
  userdata = importlib.import_module('rgthree_storage_test.utils_userdata')
  metadata = importlib.import_module('rgthree_storage_test.utils_metadata')
  monkeypatch.setattr(userdata, 'USERDATA', str(tmp_path / 'legacy-userdata'))
  monkeypatch.delenv('RGTHREE_METADATA_DIR', raising=False)
  # Fail before any network access can occur.
  monkeypatch.setattr(
    info.requests, 'get', lambda *a, **k: pytest.fail('Unexpected network call')
  )
  return info, userdata, metadata, models, events


def model(
  tmp_path, models, name='example.safetensors', category='loras', root='weights'
):
  path = tmp_path / root / name
  path.parent.mkdir(parents=True, exist_ok=True)
  header = json.dumps({'__metadata__': {'ss_sd_model_name': 'example'}}).encode()
  path.write_bytes(len(header).to_bytes(8, 'little') + header)
  models[(category, name)] = str(path)
  return path


def test_default_preserves_adjacent_storage_and_userdata(tmp_path, storage):
  info, userdata, _, models, _ = storage
  path = model(tmp_path, models)
  info.save_model_info(path.name, {'notes': 'legacy'}, 'loras')
  assert json.loads(Path(f'{path}.rgthree-info.json').read_text()) == {
    'notes': 'legacy'
  }
  assert info.get_model_info_file_data(path.name, 'loras')['notes'] == 'legacy'
  userdata.save_userdata_json('info/cache.json', {'old': True})
  assert userdata.read_userdata_json('info/cache.json') == {'old': True}
  assert Path(userdata.USERDATA, 'info/cache.json').exists()
  asyncio.run(
    info.delete_model_info(path.name, 'loras', del_metadata=False, del_civitai=False)
  )
  assert not Path(f'{path}.rgthree-info.json').exists()


def test_external_full_flow_preserves_read_only_weights_and_legacy(
  tmp_path, storage, monkeypatch
):
  info, userdata, metadata, models, events = storage
  path = model(tmp_path, models)
  legacy = Path(f'{path}.rgthree-info.json')
  legacy.write_text(json.dumps({'notes': 'keep legacy'}))
  legacy_bytes = legacy.read_bytes()
  weights_bytes = path.read_bytes()
  root = tmp_path / 'persistent-metadata'
  monkeypatch.setenv('RGTHREE_METADATA_DIR', str(root))
  original_open = builtins.open

  def guarded_open(file, mode='r', *args, **kwargs):
    if any(flag in mode for flag in 'wax+') and Path(file).is_relative_to(path.parent):
      raise OSError(30, 'Read-only model filesystem')
    return original_open(file, mode, *args, **kwargs)

  monkeypatch.setattr(builtins, 'open', guarded_open)
  assert info.get_model_info_file_data(path.name, 'loras')['notes'] == 'keep legacy'
  file_hash = info._get_sha256_hash(str(path))
  cache_name = info._get_info_cache_file(file_hash, 'civitai')
  userdata.save_userdata_json(
    cache_name, {'response': {'name': 'version', 'model': {'name': 'test'}}}
  )
  result = asyncio.run(
    info.get_model_info(
      path.name, 'loras', maybe_fetch_civitai=True, maybe_fetch_metadata=True
    )
  )
  assert result['notes'] == 'keep legacy'
  assert result['name'] == 'test - version'
  assert result['sha256'] == file_hash
  assert events
  assert info.get_file_info(path.name, 'loras')['hasInfoFile']
  external = Path(metadata.get_external_info_path(str(path), 'loras'))
  assert external.exists()
  assert info.get_info_file(str(path), model_type='loras') == str(external)
  asyncio.run(info.set_model_info_partial(path.name, 'loras', {'notes': 'updated'}))
  assert info.get_model_info_file_data(path.name, 'loras')['notes'] == 'updated'
  asyncio.run(info.delete_model_info(path.name, 'loras'))
  assert info.get_model_info_file_data(path.name, 'loras') == {}
  assert userdata.read_userdata_json(cache_name) is None
  assert 'notes' not in asyncio.run(info.get_model_info(path.name, 'loras'))
  assert path.read_bytes() == weights_bytes
  assert legacy.read_bytes() == legacy_bytes
  assert not Path(userdata.USERDATA).exists()
  userdata.save_userdata_file('fresh/subdir/note.txt', 'cache text')
  assert userdata.read_userdata_file('fresh/subdir/note.txt') == 'cache text'
  userdata.delete_userdata_file('fresh/subdir/note.txt')
  assert userdata.read_userdata_file('fresh/subdir/note.txt') is None


def test_clear_legacy_before_first_external_save(tmp_path, storage, monkeypatch):
  info, _, _, models, _ = storage
  path = model(tmp_path, models)
  legacy = Path(f'{path}.rgthree-info.json')
  legacy.write_text(json.dumps({'notes': 'old legacy'}))
  monkeypatch.setenv('RGTHREE_METADATA_DIR', str(tmp_path / 'metadata'))
  asyncio.run(
    info.delete_model_info(path.name, 'loras', del_metadata=False, del_civitai=False)
  )
  assert info.get_model_info_file_data(path.name, 'loras') == {}
  assert 'notes' not in asyncio.run(info.get_model_info(path.name, 'loras'))
  assert json.loads(legacy.read_text()) == {'notes': 'old legacy'}


def test_forced_refresh_fetches_mocked_civitai_and_persists_outside_weights(
  tmp_path, storage, monkeypatch
):
  info, userdata, _, models, events = storage
  path = model(tmp_path, models)
  legacy = Path(f'{path}.rgthree-info.json')
  legacy.write_text(json.dumps({'notes': 'personal note'}))
  originals = {path: path.read_bytes(), legacy: legacy.read_bytes()}
  monkeypatch.setenv('RGTHREE_METADATA_DIR', str(tmp_path / 'metadata'))
  original_open = builtins.open

  def guarded_open(file, mode='r', *args, **kwargs):
    if any(flag in mode for flag in 'wax+') and Path(file).is_relative_to(path.parent):
      raise OSError(30, 'Read-only model filesystem')
    return original_open(file, mode, *args, **kwargs)

  monkeypatch.setattr(builtins, 'open', guarded_open)
  calls = []
  response = {
    'name': 'mock version',
    'model': {'name': 'mock model'},
    'modelId': 123,
    'id': 456,
    'trainedWords': ['mock trigger'],
  }

  def mocked_get(url, **kwargs):
    calls.append((url, kwargs))
    return types.SimpleNamespace(json=lambda: dict(response))

  monkeypatch.setattr(info.requests, 'get', mocked_get)
  result = asyncio.run(
    info.get_model_info(
      path.name, 'loras', force_fetch_civitai=True, force_fetch_metadata=True
    )
  )
  file_hash = info._get_sha256_hash(str(path))
  assert calls == [
    (
      f'https://civitai.com/api/v1/model-versions/by-hash/{file_hash}',
      {'timeout': 5000},
    )
  ]
  assert result['name'] == 'mock model - mock version'
  assert result['notes'] == 'personal note'
  assert result['raw']['metadata']['ss_sd_model_name'] == 'example'
  assert result['raw']['civitai']['id'] == 456
  assert result['trainedWords'] == [{'word': 'mock trigger', 'civitai': True}]
  assert events[-1] == ('rgthree-refreshed-loras-info', {'data': result})
  assert info.get_model_info_file_data(path.name, 'loras') == result
  cache_name = info._get_info_cache_file(file_hash, 'civitai')
  assert userdata.read_userdata_json(cache_name)['response']['id'] == 456
  assert Path(userdata.clean_path(cache_name)).is_relative_to(tmp_path / 'metadata')
  assert all(file.read_bytes() == content for file, content in originals.items())


def test_collision_safe_identity_and_relocation(tmp_path, storage, monkeypatch):
  _, _, metadata, _, _ = storage
  monkeypatch.setenv('RGTHREE_METADATA_DIR', str(tmp_path / 'metadata'))
  left = str(tmp_path / 'left' / 'same.safetensors')
  right = str(tmp_path / 'right' / 'same.safetensors')
  left_key = metadata.get_external_info_path(left, 'loras')
  assert left_key == metadata.get_external_info_path(left, 'loras')
  assert left_key != metadata.get_external_info_path(right, 'loras')
  assert left_key != metadata.get_external_info_path(left, 'checkpoints')
  assert Path(left_key).parent == tmp_path / 'metadata/model-info'
  assert len(Path(left_key).stem) == 64


def test_unknown_model_does_not_create_metadata(tmp_path, storage, monkeypatch):
  info, _, _, _, _ = storage
  root = tmp_path / 'metadata'
  monkeypatch.setenv('RGTHREE_METADATA_DIR', str(root))
  info.save_model_info('missing.safetensors', {'notes': 'missing'}, 'loras')
  asyncio.run(info.delete_model_info('missing.safetensors', 'loras'))
  assert asyncio.run(info.get_model_info('missing.safetensors', 'loras')) is None
  assert not root.exists()


def test_relative_metadata_root_is_rejected(storage, monkeypatch):
  _, userdata, metadata, _, _ = storage
  monkeypatch.setenv('RGTHREE_METADATA_DIR', 'relative-path')
  with pytest.raises(ValueError, match='absolute path'):
    metadata.get_external_info_path('/models/example.safetensors', 'loras')
  with pytest.raises(ValueError, match='absolute path'):
    userdata.clean_path('info/cache.json')
