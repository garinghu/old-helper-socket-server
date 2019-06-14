var express = require('express');
var app = express();
let axios = require('axios');

const severProxy = 'http://localhost:3000';
const GET_USERS_BY_CHATROOM_ID = `${severProxy}/getusersbychatroomid`;
const ADD_GOOD_TO_MESSAGE_REQ = `${severProxy}/addgoodtomessagereq`;
const GET_USERINFO_BY_ID = `${severProxy}/getuserinfobyid`;
const GET_ALL_FRIEND_REQ = `${severProxy}/getallfriendreq`;

app.all('*', function(req, res, next) {  
    res.header("Access-Control-Allow-Origin", "*");  
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");  
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");  
    res.header("X-Powered-By",' 3.2.1')  
    next();  
});

var server = require('http').createServer(app);
var io = require('socket.io')(server, { wsEngine: 'ws' });

var users = {
    11: [],
};
var chatRooms = {

};
var chatId = 1;


app.use('/', express.static(__dirname+'/'));


app.get('/test', function(req, res) {
    res.send('123123');
});

io.on('connection', (socket)=>{
    socket.on('userJoined', (info) => onUserJoined(info.userId, info.chatId, socket));
    socket.on('message', (message) => onMessageReceived(message.message, socket, message.userInfo, message.chatId));
    socket.on('userJoinedAllRoom', (userid) => onUserJoinedAllRoom(userid, socket));
    socket.on('addFriends', (info) => onAddFriends(info, socket));
    socket.on('addMessageGoods', (info) => onAddMessageGoods(info, socket));
    // 轮询查看同意的好友申请
    // var getFriendReqInterval = setInterval(() => {
    //     var emitter = socket.broadcast;
    //     axios.get(GET_ALL_FRIEND_REQ)
    //     .then(res => {
    //         for(let i in res.data) {
    //             if(res.data[i].request) {
    //                 emitter.emit('getFriendReq', { info: res.data[i] });
    //             }
    //         }
    //     })
    // }, 10000)
})

setInterval(() => {
    var emitter = io;
    emitter.emit('test');
}, 500)

function onAddFriends(info, socket, fromServer) {
    var emitter = fromServer ? io : socket.broadcast;
    emitter.emit('addFriends', { info });
}

function onAddMessageGoods(info, socket, fromServer) {
    var emitter = fromServer ? io : socket.broadcast;
    const {userid, messageId, whom} = info
    emitter.emit('getMessageGoods', {userid, messageId, whom});
    axios.post(ADD_GOOD_TO_MESSAGE_REQ, {
        userid, messageId, whom
    })
    .then(function (response) {
        console.log('onAddMessageGoods', response.data);
    })
    .catch(function (error) {
        console.log(error);
    });
}

function onUserJoinedAllRoom(userid, socket) {
    users[userid.userid] = [];
}

function onUserJoined(userId, inchatId, socket) {
    console.log('userJoined');
    try {
        if(!users[userId]) {
            users[userId] = [];
        }
        users[userId].push(inchatId);
        socket.join(inchatId);
        users[socket.id] = userId;
        _sendExistingMessages(socket);
    } catch(err) {
        console.log(err);
    }
}

function _sendExistingMessages(socket) {
}

function onMessageReceived(message, senderSocket, userInfo, chatId) {
    // var userId = users[senderSocket.id];
    console.log('onMessageReceived');
    _sendAndSaveMessage(message, senderSocket, userInfo, null, chatId);
}

function _sendAndSaveMessage(message, socket, userInfo, fromServer, testChatId) {
    var messageData = {
        text: message.text,
        user: message.user,
        createdAt: new Date(message.createdAt),
        chatId: testChatId || chatId
    };
    axios.post(GET_USERS_BY_CHATROOM_ID, {
        chatId: testChatId,
    })
    .then(function (response) {
        const userId = message.user._id;
        let usersArr = response.data.split(',')
        usersArr.splice(usersArr.indexOf(userId + ''), 1);
        const withWhom = usersArr.join('');
        var emitter = fromServer ? io : socket.broadcast;
        if(!users[withWhom] || !users[withWhom].includes(testChatId)) {
            const { userid, username, headImg } = userInfo;
            emitter.emit('notInRoomTip', {
                userid,
                chatid: testChatId,
                username,
                headImg,
                lastMessage: message.text,
                lastMessageTime: message.createdAt,
            })
        }
        emitter.in(testChatId || chatId).emit('message', [message]);
    })
    .catch(function (error) {
        console.log(error);
    });
}

function testSendMessages(message, socket, fromServer, testChatId) {
    axios.post(GET_USERS_BY_CHATROOM_ID, {
       chatId: testChatId,
    })
    .then(function (response) {
        console.log(response.data);
        const userId = message.user._id;
        let usersArr = response.data.split(',')
        usersArr.splice(usersArr.indexOf(userId + ''), 1);
        const withWhom = usersArr.join('');
        // 对方是否在线
        console.log(users[withWhom]);
    })
    .catch(function (error) {
        console.log(error);
    });
}

var stdin = process.openStdin();
stdin.addListener('data', function(d) {
    if(d.toString().trim() == 'testadd') {
        onAddFriends({
            userInfo: {
                userid: 11,
                username: 'test',
                headImg: 'http://cdn.duitang.com/uploads/item/201505/30/20150530201812_rPAkY.thumb.700_0.jpeg',
            },
            to: 1,
            text: '聊聊人生',
            date: new Date(),
        }, null, true)
    } else {
        _sendAndSaveMessage({
            text: d.toString().trim(),
            createdAt: new Date(),
            user: { _id: 11 },
            _id: `${new Date()}`
        }, null /* no socket */, {
            userid: 11,
            username: 'test',
            headImg: 'http://cdn.duitang.com/uploads/item/201505/30/20150530201812_rPAkY.thumb.700_0.jpeg',
        }, true /* send from server */, 1);
    }
});

server.listen(8088);