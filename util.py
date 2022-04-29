def colIdxToLetter(column):
    temp = letter = ''
    while (column > 0):
        temp = (column - 1) % 26
        letter = chr(temp + 65) + letter
        column = (column - temp - 1) / 26
    return letter


def coordsToA1(x, y):
    return f'{colIdxToLetter(x)}{y}'