$(function() {

    // var agentName = prompt("Please enter your name");
    var $chatWindow = $('#messages');
    var chatClient; 
    var newChannel;
    var username; // server assigned

    //If its the first channel to come in, only bring it up on the channel list and nothing else. Set to false later on when done setting up the first channel.
    var first = true;

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

    // Get an access token, happens only once
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

    //happens everytime someone texts in
    function enterChannel(){
        if (first == true) {
            console.log("entered enterChannel function");
            chatClient.on('channelAdded', function(channel) {  
                $("#channel-list").prepend("<div class='list-item' id="+channel.uniqueName+"><p class='pull-left'>"+ channel.uniqueName + "</p></div>");
                console.log('new channel name: ' + channel.uniqueName);
                setupChannel();
            });
        } else {

            setupChannel();
        }
    }

    // Set up channel after it has been found
    function setupChannel() {
        if (first != true) {
            newChannel.join().then(function(channel) {
                print('Joined channel as ' + username);
            });

            // Create Leave channel button only if one does not exist already
            if (document.getElementById('leave-' + newChannel.uniqueName) == undefined) {
                var leaveButton = document.createElement('button');
                leaveButton.setAttribute('class', 'leave-channel');
                leaveButton.innerHTML = "Leave Channel";
                leaveButton.setAttribute('id', 'leave-' + newChannel.uniqueName);

                var header = document.getElementById('channel-header');
                header.append(leaveButton);              
            }


            // Get the last 5 messages
            newChannel.getMessages(5).then(function (messages) {
                for (var i = 0; i < messages.items.length; i++) {
                    if (messages.items[i].author !== undefined) {
                        if (messages.items[i].body != undefined && messages.items[i].body.length != 0) {
                            printMessage(newChannel.uniqueName, messages.items[i].author, messages.items[i].body);
                        }
                        if (messages.items[i].attributes["media_url"] != undefined) {
                            printMediaMessage(newChannel.uniqueName, messages.items[i].author, messages.items[i].body, messages.items[i].attributes["media_url"], messages.items[i].attributes["encoded_url"], messages.items[i].attributes["media_content_type"], messages.items[i].attributes["image_text"]);
                        }
                    }
                }
            });

            // Fired when a new Message has been added to the Channel on the server.
            newChannel.on('messageAdded', function(message) {
                console.log(message.body);
                if (message.body != undefined && message.body.length != 0) {
                    printMessage(newChannel.uniqueName, message.author, message.body);
                }
                if (message.attributes["media_url"] != undefined) {
                    console.log(message.attributes["image_text"]);
                    printMediaMessage(newChannel.uniqueName, message.author, message.body, message.attributes["media_url"], message.attributes["encoded_url"], message.attributes["media_content_type"], message.attributes["image_text"]);
                }
            });

        }
        first = true
    }

    // Listen for clicks to switch channels
    var switchListener = document.querySelector("#channel-list");
    switchListener.addEventListener("click", changeChannel, false);

    // Listen for clicks to leave channels
    var leaveListener = document.querySelector("#channel-header");
    leaveListener.addEventListener("click", leaveChannel, false);

    // Make a selected channel active
    function changeChannel(e) {
        first = false;
        console.log('in change channel')
        console.log(e.target.getAttribute('id'));
        //if i click on the current channel, do nothing. 
        if (e.target !== e.currentTarget && e.target.getAttribute('id') != null) { // && e.target.getAttribute('id') != newChannel.sid
            $("#messages").empty(); //Clear the current messages
            // Remove the current channels leave button when you change channels.
            if (newChannel != null) {
                newChannel.removeAllListeners('messageAdded');
                var leaveBtn = "leave-" + newChannel.uniqueName;
                console.log(leaveBtn);
                if (document.getElementById(leaveBtn) != null) {
                    document.getElementById(leaveBtn).remove();
                }
            }
            chatClient.getChannelBySid(String(e.target.getAttribute('id'))).then(function (clickedChannel) {
                newChannel = clickedChannel;
                setupChannel(clickedChannel);

            });
        }
        e.stopPropagation();

    }

    function leaveChannel(e) {
        var leaveButtonId = e.target.getAttribute('id')
        newChannel.leave().then(function(channel) {
        document.getElementById(leaveButtonId).remove();
        $('#messages').empty();//Clear the current messages
        document.getElementById(leaveButtonId.substring(6)).remove();
        });
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

    function printMediaMessage(channelName, fromUser, message, mediaUrl, encodedUrl, mediaContentType, imageText) {
        var $user;
        var $container = $('<div class="chat-content">');
        imageText = imageText.replace(/(?:\r\n|\r|\n)/g, '<br />');
        if (fromUser[0] != '+') {
            if (fromUser == 'system') {
                $user = channelName + ": ";
                $imageTextContainer = '<div id="image-text">' + imageText + '</div>';
                $subcontainer = $container.append('<div class="chat-bubble left">' + '<p class="m-b-0">' + $user + '<img id="' + mediaUrl + '" src="' + mediaUrl + '" />' + "<br />" + $imageTextContainer + '</p></div');

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
            $.post('/outbound_sms', {body: $input.val(), from: newChannel.uniqueName }); // send to phone
            $input.val('');
        }
    });

    // Send button 
    $('#btn-chat').click(function() {
        newChannel.sendMessage($input.val());
        $.post('/outbound_sms', {body: $input.val(), from: newChannel.uniqueName }); // send to phone
        $input.val('');        
    });
});



/*
    Google Vision Test Code 

    function mouseoverImage(e) {
        if (e.target.getAttribute('id') != null && e.target.getAttribute('id') != "messages") {
            e.target.style.setProperty('opacity', 0.2);
            var imageText = e.target.getAttribute('data-vision');
            console.log(imageText)
            var h2 = document.createElement('h2');
            imageText = imageText.replace(/(?:\r\n|\r|\n)/g, '<br />');
            h2.innerHTML = imageText;
            h2.setAttribute('id', 'vision')
            h2.style.setProperty('position', 'relative');
            h2.style.setProperty('bottom', '250px');
            h2.style.setProperty('left', '250px');
            h2.style.setProperty('color', 'white')          
            e.target.parentNode.appendChild(h2);
        }
    }

    function mouseoutImage(e) {
        if (e.target.getAttribute('id') != null && e.target.getAttribute('id') != "messages") {
            //document.getElementById('vision').remove();
            e.target.style.setProperty('opacity', 1.0);
        }
    }

     Listens for hover on an image
        var imageListener = document.querySelector("#messages");
        imageListener.addEventListener("mouseover", mouseoverImage, false);
        imageListener.addEventListener("mouseout",  mouseoutImage, false);
        function activate(elem) {
        var a = document.getElementsByClassName('list-item');
        for (i = 0; i < a.length; i++) {
            a[i].classList.remove('active')
        }
        elem.classList.add('active');
     }
*/