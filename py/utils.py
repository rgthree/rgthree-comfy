class AnyType(str):
  """A special class that is always equal in not equal comparisons. Credit to pythongosssss"""

  def __ne__(self, __value: object) -> bool:
    return False


any_type = AnyType("*")


class ByPassTypeTuple(tuple):
  """A special class that will return additional "AnyType" strings beyond defined values.
  Credit to Trung0246
  """

  def __getitem__(self, index):
    if index > len(self) - 1:
      return AnyType("*")
    return super().__getitem__(index)
