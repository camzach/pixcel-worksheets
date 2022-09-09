async function submitForm() {
  const submitButton = document.querySelector('#submit-button');
  submitButton.disabled = true;
  const originalText = submitButton.innerText;
  submitButton.innerText = 'Saving to Google Sheets...';
  try {
    const url = await doSubmit();
    submitButton.innerText = 'Done!';
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.innerText = 'See it now!';
    setTimeout(() => {
      submitButton.disabled = false;
      submitButton.innerText = originalText;
    }, 1000);
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
  const answers = formData.get('useHash') ?
    await Promise.all(formData.getAll('answer').map(ans =>
      fetch('https://api.hashify.net/hash/md5/hex?' + new URLSearchParams({ value: ans }))
      .then(ans => ans.json())
          .then(ans => ans.Digest)
      )) :
    formData.getAll('answer');

  console.log(formData.get('useHash'));

  const spreadsheets = gapi.client.sheets.spreadsheets
  const { spreadsheetId, spreadsheetUrl } = (await spreadsheets.create({
    properties: { title: formData.get('name') },
    sheets: [{
      properties: {
        sheetId: 0,
        title: 'Worksheet',
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
        startColumn: 2,
        columnMetadata: [{ pixelSize: 50 }, ...Array(image.width).fill({ pixelSize: 25 }),]
      }],
      conditionalFormats: [
        ...Array.from(Array(image.height * image.width), (_, i) => {
          const qidx = Math.floor(Math.random() * questions.length);
          const y = Math.floor(i / image.width);
          const x = i % image.width;
          return buildCondionalFormatRule(x + 3, y, {
            type: 'CUSTOM_FORMULA',
            values: [{
              userEnteredValue: formData.get('useHash') ?
                `=EQ(TO_TEXT(INDIRECT("Hashes!${coordsToA1(1, qidx + 1)}")), \"${answers[qidx]}\")` :
                `=EQ(TO_TEXT(${coordsToA1(2, qidx + 2)}), \"${answers[qidx]}\")`,
            }]
          }, colors[i]);
        }),
        ...answers.flatMap((answer, i) => [
          buildCondionalFormatRule(1, i + 1, { type: 'NOT_BLANK' }, [255, 129, 129]),
          buildCondionalFormatRule(1, i + 1, {
            type: formData.get('useHash') ?
              'CUSTOM_FORMULA' :
              'TEXT_EQ',
            values: [{
              userEnteredValue:
                formData.get('useHash') ?
                  `=EQ(TO_TEXT(INDIRECT("Hashes!${coordsToA1(1, i + 1)}")), \"${answer}\")` :
                  answer,
            }]
          }, [186, 240, 174])
        ])
      ]
    },
    ...(formData.get('useHash') ? [{
      properties: {
        sheetId: 1,
        title: 'Hashes',
        hidden: true
      },
      data: [{
        rowData: [
          ...answers.map((_, idx) => ({
            values: [{
              userEnteredValue: {
                formulaValue: `=REGEXEXTRACT(IMPORTDATA("https://api.hashify.net/hash/md5/hex?value="&Worksheet!${coordsToA1(2, idx + 2)}),"Digest"&CHAR(34)&":"&CHAR(34)&"(.*)"&CHAR(34))`
              }
            }]
          }))
        ],
      }]
    }] : [])]
  })).result;

  return spreadsheetUrl
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
  const questions = document.querySelector('#question-list');
  if (questions.childElementCount == 1) {
    const firstQuestion = questions.querySelector('li:first-of-type');
    const btn = firstQuestion.insertBefore(document.createElement('button'), firstQuestion.querySelector('img'));
    btn.type = 'button';
    btn.onclick = () => removeQuestion(firstQuestion);
    btn.innerText = 'X';
  }
  const newQuestion = questions.querySelector('li:last-of-type').cloneNode(true);
  for (el of newQuestion.querySelectorAll('input,textarea')) {
    el.value = '';
  }
  questions.appendChild(newQuestion);
  newQuestion.querySelector('button').onclick = () => removeQuestion(newQuestion);
}

function removeQuestion(q) {
  q.remove();
  const questionList = document.querySelector('#question-list');
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

// Enable dragging
dragula([document.getElementById('question-list')]);
