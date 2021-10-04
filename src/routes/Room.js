import React, { useEffect, useRef, useState } from "react";
//import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import * as SignalR from "@microsoft/signalr";
//import { json } from "express";

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const roomID = props.match.params.roomID;
    const clientIDRef = useRef();

    useEffect(() => {

        socketRef.current = new SignalR.HubConnectionBuilder().withUrl("https://localhost:44396/signalrtc").configureLogging(SignalR.LogLevel.Information).build();
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(async (stream) => {
            userVideo.current.srcObject = stream;

            socketRef.current.on("AllUsers", users => {
                const peers = [];
                users = JSON.parse(users);
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.connectionId, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    });
                    peers.push(peer);

                });
                setPeers(peers);
            });

            socketRef.current.on("UserJoined", payload => {
                payload = JSON.parse(payload);
                var sig = JSON.parse(payload.signal);
                const peer = addPeer(sig, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                });
                setPeers(users => [...users, peer]);
            });

            socketRef.current.on("GetId", id => {
                clientIDRef.current = id;
            })

            socketRef.current.on("ReceivingReturnedSignal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.userToSignal);
                var sig = JSON.parse(payload.signal);
                item.peer.signal(sig);
            });
            await socketRef.current.start();

            socketRef.current.invoke("JoinRoom", roomID);


        });




        // socketRef.current = io.connect("http://localhost:8000/");
        // navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
        //     userVideo.current.srcObject = stream;
        //     socketRef.current.emit("join room", roomID);
        //     socketRef.current.on("all users", users => {
        //         const peers = [];
        //         users.forEach(userID => {
        //             const peer = createPeer(userID, socketRef.current.id, stream);
        //             peersRef.current.push({
        //                 peerID: userID,
        //                 peer,
        //             });
        //             peers.push(peer);

        //         });
        //         setPeers(peers);
        //     });
        //     socketRef.current.on("user joined", payload => {
        //         const peer = addPeer(payload.signal, payload.callerID, stream);
        //         peersRef.current.push({
        //             peerID: payload.callerID,
        //             peer,
        //         });

        //         setPeers(users => [...users, peer]);
        //     });
        //     socketRef.current.on("receiving returned signal", payload => {
        //         const item = peersRef.current.find(p => p.peerID === payload.id);
        //         item.peer.signal(payload.signal);
        //     })
        // });
    }, []);

    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on('signal', signal => {
            var sig = JSON.stringify(signal);
            socketRef.current.invoke("SendingSignal", JSON.stringify({ "userToSignal":userToSignal, "callerID":callerID, "signal":sig }));
            //socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        });

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        });
        var userToSignal = "";

        peer.on("signal", signal => {
            var sig = JSON.stringify(signal);
            socketRef.current.invoke("ReturningSignal", JSON.stringify({ "signal":sig, "callerID":callerID, "userToSignal":userToSignal }));
            //socketRef.current.emit("returning signal", { signal, callerID });
        });

        peer.signal(incomingSignal);

        return peer;
    }

    return (
        <Container>
            <StyledVideo muted ref={userVideo} autoPlay playsInline />
            {peers.map((peer, index) => {
                return (
                    <Video key={index} peer={peer} />
                );
            })}
        </Container>
    );
};

export default Room;
