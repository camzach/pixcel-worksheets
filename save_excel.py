from ast import Bytes
import xlsxwriter
from PIL import Image
from random import randrange
from io import BytesIO

from util import coordsToA1

def makeExcel(image, questions, answers):
    output = BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet()

    questions = [question.strip() for question in questions]
    answers = [answer.strip() for answer in answers]

    colors = image.getdata()
    for y in range(0, image.height):
        for x in range(0, image.width):
            r,g,b = colors[y * image.height + x]
            cell_fmt = workbook.add_format({'bg_color': f'#{r:02x}{g:02x}{b:02x}'})
            qidx = randrange(len(answers))
            worksheet.conditional_format(
                y+1,x+3,y+1,x+3,
                {
                    'type': 'formula',
                    'criteria': f'=AND({coordsToA1(2, qidx+2)}<>"",{coordsToA1(2, qidx+2)}={answers[qidx]})',
                    'format': cell_fmt
                }
            )

    worksheet.write(0,0, 'Questions')
    worksheet.write(0,1, 'Answers')
    for idx, q in enumerate(questions):
        worksheet.write(idx+1, 0, q)

    worksheet.set_column_pixels(3, image.width + 3, 25)
    # for i in range(image.height):
    #     worksheet.set_row_pixels(i, 25)
    workbook.close()
    output.flush()
    output.seek(0)
    return output
