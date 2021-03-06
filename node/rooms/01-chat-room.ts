import { Room } from "colyseus";
const { spawn } = require('child_process')

export class ChatRoom extends Room {
    // this room supports only 10 clients connected
    maxClients = 10;

    onCreate (options) {
        console.log("ChatRoom created!", options);
        var wolves = spawn('python2.7', ['-u','../bra-ket-wolf/main.py']);

        var nameToClient = {};

        wolves.stdout.on('data', (data) => {
            var msg = `${data}`;
            var lines = msg.split('\n');
            var l;
            for( l in lines)
            {
                var line = lines[l];
                console.log(line)
                if( line.startsWith('namedtable')) {
                    var name = line.slice(20).split(' ')[0];
                    if(nameToClient[name] != undefined) {
                        nameToClient[name].send("messages",line.slice(12));
                    }
                } else if (line.startsWith('see')) {
                    var name = line.split(' ')[1];
                    var result = line.slice(5 + name.length);
                    nameToClient[name].send("messages", result);
                } else
                    this.broadcast("messages", line);
            }
        });

        wolves.stderr.on('data', (data) => {
            var msg = `${data}`;
            console.log(msg);
            this.broadcast(msg);
        });

        wolves.on('close', () => {
            console.log('close');
            nameToClient = {};
            this.broadcast("messages", "child process ended.");
            this.broadcast("messages", "there is no graceful failure.");
            this.broadcast("messages", "restart the server and refresh page please.");
        });

        this.onMessage("message", (client, message) => {
            console.log("ChatRoom received message from", client.sessionId, ":", message);
            //this.broadcast("messages", `(${client.sessionId}) ${message}`);
            var msg = `${message}`;
            client.send("messages", "you executed `" + msg + "`");
            if(msg.startsWith('name ')) {
                nameToClient[msg.split(' ')[1]] = client;
                this.broadcast("messages", `${client.sessionId} is ${msg.split(' ')[1]}`);
                var players = "players ";
                var first = true;
                var n;
                for (n in nameToClient) {
                    if(first)
                        first = false;
                    else
                        players = players + ',';
                    players = players + n;
                }
                wolves.stdin.write(players);
                wolves.stdin.write('\n');
            } else if(msg.startsWith('start') || msg.startsWith('next')) {
                wolves.stdin.write(message);
                wolves.stdin.write('\n');
                wolves.stdin.write('table\n');
                wolves.stdin.write('namedtable\n');
            } else if(msg.startsWith('kill') ) {
                this.broadcast("messages", "killing " + msg.slice(5));
                wolves.stdin.write(message);
                wolves.stdin.write('\n');
                wolves.stdin.write('table\n');
                wolves.stdin.write('namedtable\n');
            } else if(msg.startsWith('attack') ) {
                wolves.stdin.write(message);
                wolves.stdin.write('\n');
            } else if(msg.startsWith('new') ) {
                nameToClient = {};
                this.broadcast("messages", "dropped all players");
                this.broadcast("messages", "if you want to play in the next game, use `name yourname`.");
            } else if(msg.startsWith('reset')) {
                console.log("reset");
                this.broadcast("messages", "game deleted. refresh the page");
                this.disconnect();
            } else {
                wolves.stdin.write(message);
                wolves.stdin.write('\n');
            }
        });
    }

    onJoin (client) {
        this.broadcast("messages", `${ client.sessionId } joined.`);
    }

    async onLeave (client, consented: boolean) {
      try {
        console.log(`${client.sessionId} disconnected`);
        // allow disconnected client to reconnect into this room until 10 seconds
        await this.allowReconnection(client, 10);
        console.log(`${client.sessionId} reconnected`);
        this.broadcast("messages", `${ client.sessionId } reconnected.`);
      } catch (e) {
        // 10 seconds expired. let's remove the client.
        console.log(`${client.sessionId} left`);
        this.broadcast("messages", `${ client.sessionId } left.`);
      }
    }

    onDispose () {
        console.log("Dispose ChatRoom");
    }

}
