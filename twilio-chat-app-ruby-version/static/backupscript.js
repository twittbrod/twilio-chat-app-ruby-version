$(function() {

    // var agentName = prompt("Please enter your name");
    var $chatWindow = $('#messages');
    var chatClient; 
    var newChannel;
    var username; // server assigned

    // Helper function to print info messages to the chat window
    function print(infoMessage, asHtml) {
        var $msg = $('<div class="info">');
        if (asHtml) {
            $msg.html(infoMessage);
        } else {
            $msg.text(infoMessage);
        }
        $chatWindow.append($msg);
    }

    // Helper function to print chat message to the chat window
    function printMessage(fromUser, message) {
        var $user = $('<span class="username">').text(fromUser + ':');
        if (fromUser === username) {
            $user.addClass('me');
        }
        var $message = $('<span class="message">').text(message);
        var $container = $('<div class="message-container">');
        // $container.append($date).append('<br/>');
        $container.append($user).append($message);
        $chatWindow.append($container);
        $chatWindow.scrollTop($chatWindow[0].scrollHeight);
    }

    // Get an access token 
    $.getJSON('/token', {
        device: 'browser'
    }, function(data) {
        // Alert the user they have been assigned a random username
        username = data.identity;
        console.log(username);
        print('Signing you in, ' + username);

        // Initialize the Chat client
        chatClient = new Twilio.Chat.Client(data.token);
        chatClient.getSubscribedChannels().then(joinChannel);
    });

    function joinChannel(){
        chatClient.on('channelAdded', function(channel) {  
            console.log("Joined channel's name: " + channel.uniqueName);
            newChannel = channel;
            setupChannel();

        });
    }

    // Set up channel after it has been found
    function setupChannel() {
        // newChannel.join().then(function(channel) {
        //     print('Joined channel as ' + username);
        // });
    // Fired when a new Message has been added to the Channel on the server.
        newChannel.on('messageAdded', function(message) {
            console.log(message.body);
            printMessage(message.author, message.body);
        $('#leave').click(function(){
            newChannel.leave();
            // the widget should close
        });
        });
    }

    // Send a new message to the channel
    var $input = $('#chat-input');
    $input.on('keydown', function(e) {
        if (e.keyCode == 13) {
            newChannel.sendMessage($input.val());
            $.post('/outgoing-sms', {body: $input.val(), channel: newChannel.uniqueName }); // send to phone
            $input.val('');
        }
    });
});

    // function createOrJoinGeneralChannel() {
    //     print('Attempting to join "general" chat channel...');
    //     var promise = chatClient.getChannelByUniqueName('general');
    //     promise.then(function(channel) {
    //         generalChannel = channel;
    //         console.log('Found general channel:');
    //         console.log(generalChannel);
    //         setupChannel();
    //     }).catch(function() {
    //         // If it doesn't exist, let's create it
    //         console.log('Creating general channel');
    //         chatClient.createChannel({
    //             uniqueName: 'general',
    //             friendlyName: 'General Chat Channel'
    //         }).then(function(channel) {
    //             console.log('Created general channel:');
    //             console.log(channel);
    //             generalChannel = channel;
    //             setupChannel();
    //         });
    //     });
    // }
