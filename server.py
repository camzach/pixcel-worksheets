import json
from save_excel import makeExcel
from save_google import google as saveGoogle
from flask import Flask, redirect, render_template, request, send_file, session, url_for
from flask_session import Session
from PIL import Image
import os
from urllib.parse import urljoin
from google_auth_oauthlib.flow import Flow
import datetime

app = Flask(__name__)
SESSION_TYPE = "filesystem"
PERMANENT_SESSION_LIFETIME = 800

app.config.update(SECRET_KEY=os.urandom(24))
app.config.from_object(__name__)
Session(app)

def process_args(form):
    image = Image.open(request.files.get('photo')).convert('RGB')
    try:
        height = int(form.get('height'))
        width = int(form.get('width'))
        image = image.resize([width, height])
    except ValueError:
        pass
    questions = [q.strip() for q in form.get('questions').strip().split('\n')]
    answers = [a.strip() for a in form.get('answers').strip().split('\n')]
    name = form.get('name').strip()
    return image, questions, answers, name

@app.post('/excel')
def sendExcel():
    image, questions, answers, name = process_args(request.form)
    excelfile = makeExcel(image, questions, answers)
    return send_file(excelfile, download_name=f'{name}.xlsx', as_attachment=True)

@app.get('/googleLogin')
def googleLogin():
    flow = Flow.from_client_config(
        json.loads(os.environ.get('GOOGLE_CREDS')),
        ['https://www.googleapis.com/auth/spreadsheets']
    )
    flow.redirect_uri = urljoin(request.host_url, 'googleCallback')
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true')
    return redirect(authorization_url)

@app.get('/googleCallback')
def googleCallback():
    flow = Flow.from_client_config(
        json.loads(os.environ.get('GOOGLE_CREDS')),
        ['https://www.googleapis.com/auth/spreadsheets']
    )
    flow.redirect_uri = urljoin(request.host_url, 'googleCallback')
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
    image, questions, answers, name = process_args(request.form)
    saveGoogle(creds, name, image, questions, answers)
    return 'done :)'

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
