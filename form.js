async function submitForm() {
  const submitButton = document.querySelector('#submit-button');
  submitButton.disabled = true;
  const originalText = submitButton.innerText;
  submitButton.innerText = 'Saving to Google Sheets...';
  try {
    await doSubmit();
    setTimeout(() => {
      submitButton.innerText = 'Done!';
      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.innerText = originalText;
      }, 1000);
    }, 2000);
  } catch (err) {
    submitButton.innerText = 'Error while saving sheet';
    setTimeout(() => {
      submitButton.disabled = false;
      submitButton.innerText = originalText;
    }, 1000);
    console.error(err);
  }
}

async function doSubmit() {
  const form = document.querySelector('#form');
  const formData = new FormData(form);

  const questions = formData.getAll('question');
  const answers = formData.getAll('answer');

  const spreadsheets = gapi.client.sheets.spreadsheets

  const spreadsheetId = (await spreadsheets.create({
    properties: { title: formData.get('name') }
  })).result.spreadsheetId;

  const values = [
    ['Questions', 'Answers'],
    ...questions.map(q => [q])
  ];

  await spreadsheets.values.update({
    spreadsheetId,
    range: 'A:B',
    valueInputOption: 'USER_ENTERED',
    values
  });

  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    const image = new Image();
    reader.onload = (e) => {
      image.src = e.target.result;
    }
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.height = parseInt(formData.get('height')) || image.height;
      canvas.width = parseInt(formData.get('width')) || image.width;
      if (canvas.height > 50 || canvas.width > 50) {
        reject('Image is too large. Try using the height/width settings.')
      }
      ctx.scale(canvas.width / image.width, canvas.height / image.height);
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(data);
    }
    reader.readAsDataURL(formData.get('image'));
  });
  const colors = image.data.reduce((all, one, i) => {
    const ch = Math.floor(i / 4);
    all[ch] = [].concat((all[ch] || []), one);
    return all
  }, []);

  const requests = [
    {
      deleteDimension: {
        range: {
          sheetId: 0,
          dimension: "ROWS",
          startIndex: questions.length + 1,
        }
      }
    },
    {
      deleteDimension: {
        range: {
          sheetId: 0,
          dimension: "COLUMNS",
          startIndex: 3,
        }
      }
    },
    {
      "appendDimension": {
        "sheetId": 0,
        "dimension": "ROWS",
        "length": image.height - questions.length - 1
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
          "endIndex": Math.max(image.height, questions.length) + 1
        },
        "properties": {
          "pixelSize": 25
        },
        "fields": "pixelSize"
      }
    }
  ]
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const qidx = Math.floor(Math.random() * questions.length);
      const [r, g, b] = colors[y * image.height + x]
      requests.push({
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
                    `=EQ(TO_TEXT(${coordsToA1(2, qidx + 2)}), \"${answers[qidx]}\")`,
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
      });
    }
  }

  for (let i = 0; i < questions.length; i++) {
    requests.push(...[{
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
              'type': 'TEXT_EQ',
              'values': [{
                "userEnteredValue": answers[i]
              }]
            },
            'format': {
              'backgroundColor': {
                'red': 186 / 255.0,
                'green': 240 / 255.0,
                'blue': 174 / 255.0,
              }
            }
          }
        },
        'index': 0
      }
    }, {
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
              'type': 'NOT_BLANK',
            },
            'format': {
              'backgroundColor': {
                'red': 255 / 255.0,
                'green': 129 / 255.0,
                'blue': 129 / 255.0,
              }
            }
          }
        },
        'index': 1
      }
    }])
  };

  const q = await spreadsheets.batchUpdate({
    spreadsheetId,
    requests
  });
}

function addQuestion() {
  const questions = document.querySelector('#questionList');
  const newQuestion = questions.querySelector('li:last-of-type').cloneNode(true);
  for (el of newQuestion.querySelectorAll('input')) {
    el.value = '';
  }
  const button = newQuestion.querySelector('button')
  ?? newQuestion.appendChild(document.createElement('button'));
  button.type="button";
  button.onclick = () => removeQuestion(newQuestion);
  button.innerText = 'X';
  questions.appendChild(newQuestion);
  if (questions.childElementCount == 2) {
    const firstQuestion = questions.querySelector('li:first-of-type');
    const btn = firstQuestion.appendChild(document.createElement('button'));
    btn.type = 'button';
    btn.onclick = () => removeQuestion(firstQuestion);
    btn.innerText = 'X';
  }
}

function removeQuestion(q) {
  q.remove();
  const questionList = document.querySelector('#questionList');
  if (questionList.childElementCount == 1) {
    questionList.querySelector('li button').remove();
  }
}

function colIdxToLetter(column) {
  let temp = letter = ''
  while (column > 0) {
    temp = (column - 1) % 26
    letter += String.fromCharCode(temp + 65)
    column = (column - temp - 1) / 26
  }
  return letter
}

function coordsToA1(x, y) {
  return `${colIdxToLetter(x)}${y}`;
}
