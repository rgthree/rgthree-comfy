def get_param(request, param, default=None):
  """Gets a param from a request."""
  return request.rel_url.query[param] if param in request.rel_url.query else default
