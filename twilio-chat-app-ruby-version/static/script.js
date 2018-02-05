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
        chatClient.getSubscribedChannels().then(enterChannel);
    });

    function enterChannel(){
        console.log("entered enterChannel function");
        chatClient.on('channelAdded', function(channel) {  
            $("#channel-list").prepend("<div class='list-item' id="+channel.uniqueName+"><p class='pull-left'>"+ channel.uniqueName + "</p></div>");
            console.log('new channel name: ' + channel.uniqueName);
            newChannel = channel;
            setupChannel();
        });
    }

    // Set up channel after it has been found
    function setupChannel() {

        newChannel.join().then(function(channel) {
            print('Joined channel as ' + username);
        });

        // Get the last 5 messages
        newChannel.getMessages(5).then(function (messages) {
            for (var i = 0; i < messages.items.length; i++) {
                if (messages.items[i].author !== undefined) {
                    printMessage(newChannel.uniqueName, messages.items[i].author, messages.items[i].body);
                }
            }
        });

        // Fired when a new Message has been added to the Channel on the server.
        newChannel.on('messageAdded', function(message) {
            console.log(message.body);
            printMessage(newChannel.uniqueName, message.author, message.body);
        });
    }

    // Listen for clicks to switch channels
    var switchListener = document.querySelector("#channel-list");
    switchListener.addEventListener("click", changeChannel, false);

    // Make a selected channel active
    function changeChannel(e) {
        console.log(e.target.getAttribute('id'));
        //if i click on the current channel, do nothing. 
        if (e.target !== e.currentTarget && e.target.getAttribute('id') != null && e.target.getAttribute('id') != newChannel.sid) {
            $("#messages").empty(); //Clear the current messages
            newChannel.removeAllListeners('messageAdded');
            chatClient.getChannelBySid(String(e.target.getAttribute('id'))).then(function (clickedChannel) {
                newChannel = clickedChannel;
                setupChannel(clickedChannel);

            });
        }
        e.stopPropagation();
    }

    $('#channel-list').on('click', '.list-item', function() {
        console.log('clicked');
        $('.list-item').removeClass('active');
        $(this).addClass('active');
    })

    function printMessage(channelName, fromUser, message) {
        var $user;
        var $container = $('<div class="chat-content">');
        if (fromUser[0] != '+') {
            if (fromUser == 'system') {
                $user = channelName + ": ";
                $subcontainer = $container.append('<div class="chat-bubble left">' + '<p class="m-b-0">' + $user + ' ' + message + '</p></div>');
            }
            else {
                $user = "Agent" + ": ";  // print the sender's name
                $subcontainer = $container.append('<div class="chat-bubble pull-right right">' + '<p class="m-b-0">' + $user + ' ' + message + '</p></div>');
            }
        }
        else {
            $user = $('<strong class="">' ).text(channelName + ": ");
        }

        $chatWindow.prepend($container);
        // $chatWindow.scrollTop($chatWindow[0].scrollHeight);
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

    // Send button 
    $('#btn-chat').click(function() {
        newChannel.sendMessage($input.val());
        $.post('/outgoing-sms', {body: $input.val(), channel: newChannel.uniqueName }); // send to phone
        $input.val('');        
    });

});

    

    //     function activate(elem) {
    //     var a = document.getElementsByClassName('list-item');
    //     for (i = 0; i < a.length; i++) {
    //         a[i].classList.remove('active')
    // }
    // elem.classList.add('active');
    // }
