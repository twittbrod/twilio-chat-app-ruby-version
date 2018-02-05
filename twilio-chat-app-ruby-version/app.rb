require 'twilio-ruby'
require 'sinatra'
require 'sinatra/json'
require 'dotenv'
require 'faker'
require 'rack/contrib'
require 'facets/string/snakecase'
require 'pry'
require 'pry-byebug'
require 'base64'
require 'google/cloud/vision'

# Load environment configuration
Dotenv.load

# Set public folder
set :public_folder, 'public'

# Parse JSON Body parts into params
use ::Rack::PostBodyContentTypeParser

#Constants
TWILIO_ACCOUNT_SID = ENV['TWILIO_ACCOUNT_SID']
TWILIO_AUTH_TOKEN = ENV['TWILIO_AUTH_TOKEN']
TOLL_FREE_NUM = "+12156081475"
PROJECT_ID = "mms-chat-vision"

$token_identity = ""

# Render home page
get '/' do
    redirect '/index.html'
end

# Render Chat page
get '/chat/' do
    redirect '/static/index.html'
end

# Basic health check - check environment variables have been configured correctly
get '/config' do
    content_type :json
    {
        TWILIO_ACCOUNT_SID: ENV['TWILIO_ACCOUNT_SID'],
        TWILIO_API_KEY: ENV['TWILIO_API_KEY']   ,
        TWILIO_API_SECRET: ENV['TWILIO_API_SECRET'] != '',
        TWILIO_CHAT_SERVICE_SID: ENV['TWILIO_CHAT_SERVICE_SID'],
    }.to_json
end

# Generate an Access Token for an application user - it generates a random
# username for the client requesting a token
get '/token' do
  # Create a random username for the client
  identity = Faker::Internet.user_name

  # Create an access token which we will sign and return to the client
  token = generate_token(identity)
  $token_identity = identity

  # Generate the token and send to client
  json :identity => identity, :token => token
end

# Generate an Access Token for an application user with the provided identity
post '/token' do
  identity = params[:identity]

  token = generate_token(identity)

  # Generate the token and send to client
  json :identity => identity, :token => token
end

post '/incoming_sms' do
  sender = params["From"]
  incoming_body = params["Body"]
  client = Twilio::REST::Client.new(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  service = client.chat.v2.services(ENV['TWILIO_CHAT_SERVICE_SID'])

  #outgoing_body = "We've received your request. Please hang tight while the next available agent is connected!"
  #send_sms(sender, TOLL_FREE_NUM, outgoing_body)
  #sender = sender + Random.rand(100000).to_s

  #Check if user has texted in before, if not create a new channel
  uniq_names = service.channels.list.map {|x| x.unique_name}
  unless uniq_names.include?(sender)
    channel = service.channels.create(unique_name: sender)
    puts "Channel #{channel.sid} (\"#{channel.unique_name}\") created!"
    user = service.users.create(identity: sender)
    puts user
    member = channel.members.create(identity: user.identity)
    puts member
    member2 = channel.members.create(identity: $token_identity)
    puts member2
  else
    puts "NOT A UNIQUE CHANNEL"
    channel = service.channels(sender).fetch()
    identities = channel.members.list.map {|x| x.identity}
    unless identities.include?($token_identity)
      member2 = channel.members.create(identity: $token_identity)
    end
    #Check if client is a member of this one, if not create it
    puts "channel name is #{channel.unique_name}"
    puts $token_identity
    puts member2
  end

  channel = service.channels(sender).fetch
  if params["NumMedia"].to_i > 0
    add_chat_message_with_media(params['MediaUrl0'], params['MediaContentType0'], incoming_body, sender)
  else
    add_chat_message(incoming_body, sender)
  end
  puts params
end

post '/outbound_sms' do 
  puts params
  channel_sid = params["ChannelSid"]
  from = params["from"]
  body = params["body"]
  to = ""
  if from == "general"
    to = "+14083986929"
  else
    to = from[0,12]
  end
  send_sms(to, TOLL_FREE_NUM, body)
end

post '/delete_all_chat_channels' do
  delete_channels()
end

def send_sms(to, from, body)
  client = Twilio::REST::Client.new(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  client.messages.create(
    from: from,
    to: to,
    body: body
  )
  puts "Sent message"
end

get '/mms_vision' do
  puts params
  return send_mms_vision(params['media_url'])
end

def add_chat_message(body, channel_sid)
  client = Twilio::REST::Client.new(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  service = client.chat.v2.services(ENV['TWILIO_CHAT_SERVICE_SID'])
  channel = service.channels(channel_sid)
  message = channel.messages.create(body: body)
  puts message
end

def add_chat_message_with_media(media_url, media_content_type, body, channel_sid)
  client = Twilio::REST::Client.new(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  service = client.chat.v2.services(ENV['TWILIO_CHAT_SERVICE_SID'])
  channel = service.channels(channel_sid)
  encoded = Base64.strict_encode64(media_url)
  image_text = send_mms_vision(media_url)
  message = channel.messages.create(body: body, attributes: {"image_text" => image_text, "encoded_url" => encoded, "media_url" => media_url, "media_content_type" => media_content_type}.to_json)
  puts message
end

def delete_channels()
  client = Twilio::REST::Client.new(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  service = client.chat.v2.services(ENV['TWILIO_CHAT_SERVICE_SID'])
  channels = service.channels.list()
  users = service.users.list()
  users.each do |user|
    puts user.identity
    user.delete()
  end
  channels.each do |channel|
    puts channel.unique_name
    channel.delete()
  end
  return "Complete"
end

def send_mms_vision(image_url)
  vision = Google::Cloud::Vision.new project: PROJECT_ID
  image = vision.image(image_url)
  text = image.document.text
  puts text
  return text
end


  '''

      for page in document.pages:
        for block in page.blocks:
            block_words = []
            for paragraph in block.paragraphs:
                block_words.extend(paragraph.words)

            block_symbols = []
            for word in block_words:
                block_symbols.extend(word.symbols)

            block_text = ''
            for symbol in block_symbols:
                block_text = block_text + symbol.text

            print("Block Content: {}".format(block_text))
            print("Block Bounds:\n {}".format(block.bounding_box))

document.pages.each do |page|
  page.blocks.each do |block|
    block_words = []
    block.paragraphs.each do |paragraph|
      block_words << paragraph.words
    end

    puts "h"
    puts block_words

    block_symbols = []
    block_words.each do |word|
      puts word.class
      block_symbols << word.map{|x| x.symbols}
    end

    puts "s"
    puts block_symbols

    block_text = ''
    block_symbols.each do |symbol|
      puts symbol.class
      symbol = symbol.map{|x| x.}
      block_text += block_text + symbol.text
    end

    puts "Block Content: #{block_text}"
    puts "Block Bounds:\n #{block.bounding_box}"
  end
end
'''

def generate_token(identity)
  # Create an access token which we will sign and return to the client
  token = Twilio::JWT::AccessToken.new ENV['TWILIO_ACCOUNT_SID'],
  ENV['TWILIO_API_KEY'], ENV['TWILIO_API_SECRET'], identity: identity

  # Grant the access token Chat capabilities (if available)
  if ENV['TWILIO_CHAT_SERVICE_SID']

    # Create the Chat Grant
    grant = Twilio::JWT::AccessToken::IpMessagingGrant.new
    grant.service_sid = ENV['TWILIO_CHAT_SERVICE_SID']
    token.add_grant grant
  end

  return token.to_jwt
end

def symbolize_keys(h)
  # Use the symbolize names argument of parse to convert String keys to Symbols
  return JSON.parse(JSON.generate(h), symbolize_names: true)
end

def snake_case_keys(h)
  newh = Hash.new
  h.keys.each do |key|
    newh[key.snakecase] = h[key]
  end
  return newh
end
