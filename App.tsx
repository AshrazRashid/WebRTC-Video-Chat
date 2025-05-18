import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import {
  RTCPeerConnection,
  mediaDevices,
  RTCView,
  MediaStream,
} from 'react-native-webrtc';
import io from 'socket.io-client';

const configuration = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

const App = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io('http://192.168.100.11:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      setError(null);
    });

    newSocket.on('connect_error', error => {
      console.error('Socket connection error:', error);
      setError('Failed to connect to server');
    });

    setSocket(newSocket);

    // Initialize WebRTC
    const pc = new RTCPeerConnection(configuration);
    setPeerConnection(pc);

    // Set up event listeners
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        newSocket.emit('ice-candidate', {
          candidate: event.candidate,
          room: 'test-room',
        });
      }
    };

    (pc as any).ontrack = (event: any) => {
      console.log('Received remote track:', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    // Cleanup
    return () => {
      if (pc) {
        pc.removeEventListener('icecandidate', () => {});
        pc.removeEventListener('track', () => {});
        pc.close();
      }
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      setError(null);
      console.log('Starting call...');

      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: {min: 640, ideal: 1280, max: 1920},
          height: {min: 480, ideal: 720, max: 1080},
          frameRate: {min: 15, ideal: 30, max: 60},
          facingMode: 'user',
          aspectRatio: 1.333333,
        },
      });

      console.log('Got local stream:', stream);
      setLocalStream(stream);

      if (!peerConnection) {
        throw new Error('PeerConnection not initialized');
      }

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Create and set local description
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      // Join room and send offer
      socket?.emit('join-room', 'test-room');
      socket?.emit('offer', {
        offer,
        room: 'test-room',
      });

      setIsConnected(true);
    } catch (err) {
      console.error('Error in startCall:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setIsConnected(false);
    }
  };

  const endCall = () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
      setLocalStream(null);
      setRemoteStream(null);
      setIsConnected(false);
      setError(null);
    } catch (err) {
      console.error('Error in endCall:', err);
      setError('Failed to end call properly');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.videoContainer}>
        {localStream && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.videoStream}
            objectFit="cover"
          />
        )}
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.videoStream}
            objectFit="cover"
          />
        )}
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            isConnected ? styles.buttonEnd : styles.buttonStart,
          ]}
          onPress={isConnected ? endCall : startCall}>
          <Text style={styles.buttonText}>
            {isConnected ? 'End Call' : 'Start Call'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  videoContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
  },
  videoStream: {
    width: '45%',
    height: 200,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
  },
  buttonContainer: {
    padding: 20,
    alignItems: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 25,
    width: 200,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#4CAF50',
  },
  buttonEnd: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: 10,
    margin: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 5,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
});

export default App;
