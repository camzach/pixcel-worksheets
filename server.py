import json
from save_excel import makeExcel
from save_google import google as saveGoogle
from flask import Flask, redirect, render_template, request, send_file, session, url_for
from flask_session import Session
from PIL import Image
import os

app = Flask(__name__)
SESSION_TYPE = "filesystem"
PERMANENT_SESSION_LIFETIME = 800

app.config.update(SECRET_KEY=os.urandom(24))
app.config.from_object(__name__)
Session(app)

@app.post('/excel')
def sendExcel():
    image = Image.open(request.files.get('photo')).convert('RGB')
    questions = [q.strip() for q in request.form.get('questions').split('\n')]
    answers = [a.strip() for a in request.form.get('answers').split('\n')]
    excelfile = makeExcel(image, questions, answers)
    return send_file(excelfile, download_name='worksheet.xlsx', as_attachment=True)

from google_auth_oauthlib.flow import Flow

@app.get('/googleLogin')
def googleLogin():
    flow = Flow.from_client_config(
        json.loads(os.environ.get('GOOGLE_CREDS')),
        ['https://www.googleapis.com/auth/spreadsheets']
    )
    flow.redirect_uri = os.path.join(request.host_url, 'googleCallback')
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true')
    return redirect(authorization_url)

@app.get('/googleCallback')
def googleCallback():
    flow = Flow.from_client_secrets_file(
        json.loads(os.environ.get('GOOGLE_CREDS')),
        ['https://www.googleapis.com/auth/spreadsheets']
    )
    flow.redirect_uri = os.path.join(request.host_url, 'googleCallback')
    flow.fetch_token(authorization_response=request.url)
    session['credentials'] = {
        'token': flow.credentials.token,
        'refresh_token': flow.credentials.refresh_token,
        'token_uri': flow.credentials.token_uri,
        'client_id': flow.credentials.client_id,
        'client_secret': flow.credentials.client_secret,
        'scopes': flow.credentials.scopes,
        'expiry': flow.credentials.expiry,
    }
    return redirect('/')

@app.post('/google')
def google():
    try:
        creds = session['credentials'].copy()
        del creds['expiry']
    except KeyError:
        return 'no creds'
    image = Image.open(request.files.get('photo')).convert('RGB')
    questions = [q.strip() for q in request.form.get('questions').split('\n')]
    answers = [a.strip() for a in request.form.get('answers').split('\n')]
    saveGoogle(creds, 'Mogus', image, questions, answers)
    return 'done :)'

import datetime

@app.get('/')
def root():
    has_google = False
    try:
        expiry = session['credentials']['expiry']
        if expiry > datetime.datetime.now():
            has_google = True
    except Exception as e:
        pass
    return render_template('submit-image.html', has_google=has_google)
