import os
from flask import Flask, jsonify, request
from faker import Factory
from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import (
    IpMessagingGrant
)
from dotenv import load_dotenv, find_dotenv
from os.path import join, dirname
from inflection import underscore


client = Client('AC30a80e4fdc2e5831f954e6a8ee5bed6a', 'dddf69f1de1000cd007c4b770ab6ec0f')

# Convert keys to snake_case to conform with the twilio-python api definition contract
def snake_case_keys(somedict):
    return dict(map(lambda (key, value): (underscore(key), value), somedict.items()))

app = Flask(__name__)
fake = Factory.create()
dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)
myagent = "ff"

@app.route('/')
def index():
    return app.send_static_file('index.html')

##########################################################################################
@app.route('/token', methods=['GET'])
def randomToken():
    return generateToken(fake.user_name())

@app.route('/token', methods=['POST'])
def createToken():
    # Get the request json or form data
    content = request.get_json() or request.form
    # get the identity from the request, or make one up
    identity = content.get('identity', fake.user_name())
    return generateToken(identity)

@app.route('/token/<identity>', methods=['POST', 'GET'])
def token(identity):
    return generateToken(identity)

def generateToken(identity):
    # get credentials for environment variables
    account_sid = os.environ['TWILIO_ACCOUNT_SID']
    api_key = os.environ['TWILIO_API_KEY']
    api_secret = os.environ['TWILIO_API_SECRET']
    sync_service_sid = os.environ['TWILIO_SYNC_SERVICE_SID']
    chat_service_sid = os.environ['TWILIO_CHAT_SERVICE_SID']

    # Create access token with credentials
    token = AccessToken(account_sid, api_key, api_secret, identity=identity)
    global myagent # hack
    myagent = identity


    # Create an Chat grant and add to token
    if chat_service_sid:
        chat_grant = IpMessagingGrant(service_sid=chat_service_sid)
        token.add_grant(chat_grant)

    # Return token info as JSON
    return jsonify(identity=identity, token=token.to_jwt().decode('utf-8'))

##########################################################################################


@app.route('/incoming-sms', methods=['POST', 'GET'])
def incoming_sms():
    global myagent
    print "Agent identity: " + myagent
    sender = request.values.get('From')
    message = request.values.get('Body')
    return create_chat_msg(sender, message)

def create_chat_msg(sender,msg):
    # create new channel if it doesn't exist
    try: 
        channel = client.chat \
                    .services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
                    .channels \
                    .create(unique_name=sender)
        print "New Channel SID = " + channel.sid  
        # add client to the channel
        member = client.chat \
               .services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
               .channels(sender) \
               .members \
               .create(myagent)
        # forward sms to the channel
        message = client.chat.services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
                    .channels(sender) \
                    .messages.create(body=msg)  

        print "end of new channel try"
        return ""

    # if channel exists:
    except:
        print "channel exists"
        channel = client.chat \
                .services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
                .channels(sender) \
                .fetch()
        print "Existing channel's SID: " + channel.sid

        # check if client is already a member of the channel
        try:
            member = client.chat \
               .services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
               .channels(sender) \
               .members \
               .create(myagent)
        except:
            pass

        # forward sms to the channel
        message = client.chat.services("IS545ca438ffc14ad49cc56e4cdadcbcce") \
                    .channels(sender) \
                    .messages.create(body=msg)
        print msg
          
        return ""

# webhook method of sending out sms
# @app.route('/outgoing-sms', methods=['POST', 'GET'])
# def send_sms():
#     body = request.values.get('Body')
#     channel = request.values.get('Channel')
#     print channel

#     message = client.messages.create(
#         to='+15102604231',
#         body=body,
#         from_="+15103992179"
#         )
#     return message.sid

@app.route('/outgoing-sms', methods=['POST', 'GET'])
def send_sms():
    body = request.values.get('body') # we're passing these values in the JS
    to = request.values.get('channel')
    print "Body: " + body + ", To: " + to

    message = client.messages.create(
        to=to,
        body=body,
        from_="+15103992179"
        )
    return ""


@app.route('/<path:path>')
def static_file(path):
    return app.send_static_file(path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')



