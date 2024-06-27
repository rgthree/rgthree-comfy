def get_param(request, param, default=None):
  """Gets a param from a request."""
  return request.rel_url.query[param] if param in request.rel_url.query else default

def is_param_falsy(request, param):
  """Determines if a param is explicitly 0 or false."""
  val = get_param(request, param)
  return val is not None and (val == "0" or val.upper() == "FALSE")
