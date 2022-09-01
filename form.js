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

  const questions = formData.getAll('question');
  const answers = formData.getAll('answer');

  const spreadsheets = gapi.client.sheets.spreadsheets
  const spreadsheetId = (await spreadsheets.create({
    properties: { title: formData.get('name') },
    sheets: [{
      properties: {
        sheetId: 0,
        gridProperties: {
          rowCount: Math.max(questions.length + 1, image.height),
          columnCount: image.width + 3,
        }
      },
      data: [{
        rowData: [
          {
            values: [
              { userEnteredValue: { stringValue: 'Questions' } },
              { userEnteredValue: { stringValue: 'Answers' } },
            ]
          },
          ...questions.map(q => ({
            values: [{ userEnteredValue: { stringValue: q } }]
          }))
        ],
        rowMetadata: Array(Math.max(questions.length + 1, image.height))
          .fill({ pixelSize: 25 }),
      }, {
        startColumn: 3,
        columnMetadata: Array(image.width).fill({ pixelSize: 25 }),
      }],
      conditionalFormats: [
        ...Array.from(Array(image.height * image.width), (_, i) => {
          const qidx = Math.floor(Math.random() * questions.length);
          const y = Math.floor(i / image.width);
          const x = i % image.height;
          return buildCondionalFormatRule(x + 3, y, {
            'type': 'CUSTOM_FORMULA',
            'values': [{
              'userEnteredValue':
                `=EQ(TO_TEXT(${coordsToA1(2, qidx + 2)}), \"${answers[qidx]}\")`,
            }]
          }, colors[i]);
        }),
        ...answers.flatMap((answer, i) => [
          buildCondionalFormatRule(1, i + 1, {type: 'NOT_BLANK'}, [255, 129, 129]),
          buildCondionalFormatRule(1, i + 1, {
            'type': 'TEXT_EQ',
            'values': [{
              "userEnteredValue": answer
            }]
          }, [186, 240, 174])
        ])
      ]
    }]
  })).result.spreadsheetId;
}

function buildCondionalFormatRule(x, y, condition, color) {
  return {
    ranges: [{
      sheetId: 0,
      startRowIndex: y,
      endRowIndex: y + 1,
      startColumnIndex: x,
      endColumnIndex: x + 1,
    }],
    booleanRule: {
      condition,
      format: {
        backgroundColor: {
          red: color[0] / 255.0,
          green: color[1] / 255.0,
          blue: color[2] / 255.0,
        }
      }
    }
  }
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
