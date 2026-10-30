"""LoRA lookup regressions that run without a ComfyUI installation."""
import importlib.util
import ntpath
import pathlib
import posixpath
import sys
import types
import unittest
from unittest import mock


def load_prompt_utils():
  source = pathlib.Path(__file__).resolve().parents[1] / 'py' / 'power_prompt_utils.py'
  package = types.ModuleType('_rgthree_prompt_tests')
  package.__path__ = [str(source.parent)]
  folder_paths = types.ModuleType('folder_paths')
  folder_paths.get_filename_list = mock.Mock(return_value=[])
  log = types.ModuleType('_rgthree_prompt_tests.log')
  log.log_node_info = mock.Mock()
  log.log_node_warn = mock.Mock()
  spec = importlib.util.spec_from_file_location('_rgthree_prompt_tests.power_prompt_utils', source)
  module = importlib.util.module_from_spec(spec)
  with mock.patch.dict(
    sys.modules, {
      package.__name__: package,
      'folder_paths': folder_paths,
      log.__name__: log,
    }
  ):
    spec.loader.exec_module(module)
  return module


class LoraLookupTest(unittest.TestCase):

  def setUp(self):
    self.utils = load_prompt_utils()

  def test_lookup_with_both_host_path_rules(self):
    cases = [
      ('LTX/foo.safetensors', ['LTX/foo.safetensors'], 'LTX/foo.safetensors'),
      (r'LTX\foo.safetensors', ['LTX/foo.safetensors'], 'LTX/foo.safetensors'),
      ('LTX/foo.safetensors', [r'LTX\foo.safetensors'], r'LTX\foo.safetensors'),
      (r'LTX\foo', ['LTX/foo.safetensors'], 'LTX/foo.safetensors'),
      (r'LTX\foo.ckpt', ['LTX/foo.safetensors'], 'LTX/foo.safetensors'),
      ('foo.safetensors', [r'LTX\foo.safetensors'], r'LTX\foo.safetensors'),
      (r'old\foo.safetensors', ['LTX/foo.safetensors'], 'LTX/foo.safetensors'),
      ('foo', [r'LTX\foo.safetensors'], r'LTX\foo.safetensors'),
      (r'LTX\foo', ['models/LTX/foo-extra.safetensors'], 'models/LTX/foo-extra.safetensors'),
      (r'LTX/nested\foo.safetensors', ['LTX/nested/foo.safetensors'], 'LTX/nested/foo.safetensors'),
      (r'B\foo.safetensors', ['A/foo.safetensors', 'B/foo.safetensors'], 'B/foo.safetensors'),
      ('B/foo.safetensors', [r'A\foo.safetensors', r'B\foo.safetensors'], r'B\foo.safetensors'),
      (
        r'LTX\foo.safetensors', ['LTX/foo.safetensors',
                                 r'LTX\foo.safetensors'], r'LTX\foo.safetensors'
      ),
    ]
    for path_rules in (posixpath, ntpath):
      self.utils.os = types.SimpleNamespace(path=path_rules)
      for requested, listed, expected in cases:
        with self.subTest(host=path_rules.__name__, requested=requested, listed=listed):
          self.assertEqual(self.utils.get_lora_by_filename(requested, listed), expected)

  def test_missing_name_logs_and_returns_none(self):
    self.assertIsNone(self.utils.get_lora_by_filename('missing', ['LTX/foo.safetensors'], 'test'))
    self.utils.log_node_warn.assert_called_once_with('test', 'Lora "missing" not found, skipping.')

  def test_default_candidates_come_from_comfyui(self):
    self.utils.folder_paths.get_filename_list.return_value = ['LTX/foo.safetensors']
    self.assertEqual(self.utils.get_lora_by_filename(r'LTX\foo.safetensors'), 'LTX/foo.safetensors')
    self.utils.folder_paths.get_filename_list.assert_called_once_with('loras')


if __name__ == '__main__':
  unittest.main()
