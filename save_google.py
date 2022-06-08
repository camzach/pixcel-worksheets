from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from random import randrange

from util import coordsToA1


def google(creds, name, image, questions, answers):
    creds = Credentials.from_authorized_user_info(creds)
    service = build('sheets', 'v4', credentials=creds)

    spreadsheet = {
        'properties': {
            'title': name
        }
    }

    spreadsheet = service.spreadsheets() \
        .create(body=spreadsheet, fields='spreadsheetId') \
        .execute()

        

    values = [['Questions', 'Answers'], *([question] for question in questions)]
    body = {
        'values': values
    }
    result = service.spreadsheets().values().update(
        spreadsheetId=spreadsheet['spreadsheetId'], range='A:B',
        valueInputOption='USER_ENTERED', body=body).execute()
    print('{0} cells updated.'.format(result.get('updatedCells')))

    colors = image.getdata()
    requests = [
    {
      "deleteDimension": {
        "range": {
          "sheetId": 0,
          "dimension": "ROWS",
          "startIndex": len(questions) + 1,
        }
      }
    },
    {
      "deleteDimension": {
        "range": {
          "sheetId": 0,
          "dimension": "COLUMNS",
          "startIndex": 3,
        }
      }
    },
    {
      "appendDimension": {
        "sheetId": 0,
        "dimension": "ROWS",
        "length": image.height - len(questions) - 1
      }
    },
    {
      "appendDimension": {
        "sheetId": 0,
        "dimension": "COLUMNS",
        "length": image.width
      }
    },
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": 0,
                "dimension": "COLUMNS",
                "startIndex": 3,
                "endIndex": image.width + 4
            },
            "properties": {
                "pixelSize": 25
            },
            "fields": "pixelSize"
        }
    },
    {
        "updateDimensionProperties": {
            "range": {
                "sheetId": 0,
                "dimension": "ROWS",
                "startIndex": 0,
                "endIndex": max(image.height, len(questions)) + 1
            },
            "properties": {
                "pixelSize": 25
            },
            "fields": "pixelSize"
        }
    }]
    for y in range(image.height):
        for x in range(image.width):
            qidx = randrange(len(questions))
            r,g,b = colors[y * image.height + x]
            requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                    'ranges': [{
                        'sheetId': 0,
                        'startRowIndex': y,
                        'endRowIndex': y + 1,
                        'startColumnIndex': x + 3,
                        'endColumnIndex': x + 4,
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'CUSTOM_FORMULA',
                            'values': [{
                                'userEnteredValue':
                                    f'=EQ({coordsToA1(2, qidx+2)}, \"{answers[qidx]}\")',
                            }]
                        },
                        'format': {
                            'backgroundColor': {
                                'red': r / 255.0,
                                'green': g / 255.0,
                                'blue': b / 255.0,
                            }
                        }
                    }
                },
                'index': 0
                }
            })
    for i, (q, a) in enumerate(zip(questions, answers)):
        requests.append({
                'addConditionalFormatRule': {
                    'rule': {
                    'ranges': [{
                        'sheetId': 0,
                        'startRowIndex': i + 1,
                        'endRowIndex': i + 2,
                        'startColumnIndex': 1,
                        'endColumnIndex': 2,
                    }],
                    'booleanRule': {
                        'condition': {
                            'type': 'TEXT_CONTAINS',
                            'values': [{
                                "userEnteredValue": a
                            }]
                        },
                        'format': {
                            'backgroundColor': {
                                'red': 52/255.0,
                                'green': 168/255.0,
                                'blue': 83/255.0,
                            }
                        }
                    }
                },
                'index': 0
                }
            })

    body = {
        'requests': requests
    }
    response = service.spreadsheets() \
        .batchUpdate(spreadsheetId=spreadsheet['spreadsheetId'], body=body).execute()
    print('{0} cells updated.'.format(len(response.get('replies'))))