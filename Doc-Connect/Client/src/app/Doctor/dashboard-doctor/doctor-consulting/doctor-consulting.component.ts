import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DoctorService } from '../../doctor.service';
import { FirebaseserviceService } from './firebaseservice.service';
import { Doctor } from 'src/app/models/doctor';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { environment } from 'src/environments/environment';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

interface CallData {
  offer: any; // Adjust the type according to the actual type of offer data
}

@Component({
  selector: 'app-doctor-consulting',
  templateUrl: './doctor-consulting.component.html',
  styleUrls: ['./doctor-consulting.component.css']
})
export class DoctorConsultingComponent implements  OnInit,OnDestroy  {
  patientEmail:String = '';
  isDoctor:Boolean = false;
  isLocal:Boolean = false;
  isRemote:Boolean = false;
  doctor!: Doctor;
  doctorId: any;
  callId!: string; // Store the room ID
  peerConnection!: RTCPeerConnection; // Store the peer connection
  isCalling: boolean = false; // Flag to indicate call state
  localStream!: MediaStream; // Store the local media stream
  //remoteStream!: MediaStream; // Store the remote media stream
  socketService: any;
  micButton:string = "Unmute";
  videoButton:string = "Stop Video"
  isAudioMuted: boolean = true;
  isVideoStopped: boolean = false;
  
  app:any;
  analytics:any;

  @ViewChild('webcamVideo')
  webcamVideo!: ElementRef<HTMLVideoElement>;

  @ViewChild('remoteVideo')
  remoteVideo!: ElementRef<HTMLVideoElement>;
  remoteStream: MediaStream = new MediaStream();
  
  configuration = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302', // Optional additional STUN server
        ],
      },
      {
        urls: ['turn:numb.viagenie.ca'],
        credential: 'muazkh',
        username: 'webrtc@live.com',
      },
    ],
    iceCandidatePoolSize: 5,
  };
  callEndSubscription: any;
  
  constructor( public doctorServ: DoctorService,private ngZone: NgZone , private firebaseService: FirebaseserviceService , private datePipe: DatePipe,private firestore: AngularFirestore,private router: Router, private aroute: ActivatedRoute ) { }

  async ngOnInit(): Promise<void> {

    this.aroute.queryParams.subscribe(params => {
      if (params['userData']) {
          this.patientEmail = JSON.parse(params['userData']);
          console.log("User email : ", this.patientEmail);
      }
  });

    await this.loadDoctorData();
    
    console.log(this.doctorId);
    
    // Initialize peer connection configuration (refer to WebRTC documentation)
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // Attach remote stream to video element
    this.remoteVideo.nativeElement.srcObject = this.remoteStream;
    
  }

  handleRemoteStream(event: RTCTrackEvent) {
    event.streams[0].getTracks().forEach(track => {
      this.remoteStream.addTrack(track);
    });
  }

  EndCall()
  {
    if (this.callEndSubscription) {
      console.log("listenForCallEnd destroyed");
      this.callEndSubscription.unsubscribe();
    }
    // Clean up resources when the component is destroyed
    if (this.callId) {
      const callDocRef = this.firebaseService.getCallDocument(this.callId);
      // const subscription = callDocRef.valueChanges().subscribe((callData: any) => {
      //   if (callData.ended) {
      //     // Call has ended, perform necessary tasks here
      //     console.log('Call ended by doctor');
      //     // Redirect or perform other actions as needed
      //     subscription.unsubscribe(); // Unsubscribe from the snapshot listener
      //   }
      // });
    }
    this.firebaseService.getCallDocument(this.callId).update({ ended: true })
      .then(() => {
        console.log('Call ended successfully');
      })
      .catch(error => {
        console.error('Error updating call document:', error);
      });
    this.router.navigate(['/dashboardDoctor']);
    
  }

  ngOnDestroy() {

    console.log("ngDestroy");
    // Clean up resources when the component is destroyed
    this.peerConnection.close();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    
  }

  // Function to mute audio
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if(this.micButton === "Mute")
        this.micButton = "Unmute";
      else  
      this.micButton = "Mute";
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isAudioMuted = audioTrack.enabled; // Update isAudioMuted status
      }
    }
  }

  // Function to toggle video stop
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if(this.videoButton === "Stop Video")
        this.videoButton = "Start Video"

      else  
        this.videoButton = "Stop Video"
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isVideoStopped = !videoTrack.enabled; // Update isVideoStopped status
      }
    }
  }

  loadDoctorData(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.doctorId = '';
      this.doctorId = localStorage.getItem('userId');

      this.doctorServ.getDoctor(this.doctorId).subscribe(
        data => {
          this.doctor = data;
          this.isDoctor = true;
          //console.log("DashBoard");
          // console.log(this.doctor);
          //this.calculateTimeSlots();
          resolve();
        },
        error => {
          console.error("error", error);
          reject(error);
        }
      );
    });
  }

  async startWebcam()
  {
    // console.log("in startWebcame");
    this.localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: { 
        autoGainControl: true, 
        noiseSuppression: true, 
        echoCancellation: true 
      } 
    });    
    this.isLocal = true;
    
    this.localStream.getAudioTracks()[0].enabled = false;
    console.log("in startWebcame1");
    // Push tracks from local stream to peer connection
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    // Show local stream in the video element
    if (this.localStream) {
      this.webcamVideo.nativeElement.srcObject = this.localStream;
    }

    this.peerConnection.ontrack = event => {
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream!.addTrack(track);
      });
    };
  }

  async initiateCall() {
    // Obtain user media permissions using navigator.mediaDevices.getUserMedia()
    // ... (access media devices, create local stream)

    // Create an offer and add the local stream to the peer connection
    try {
      if (!this.localStream) {
        console.error("Local stream not available. Please start webcam first.");
        return;
      }
      //console.log("InitiaeCall called.");
      const callDocRef = await this.firebaseService.createCallDocument();
      //console.log("createCallDocument completed.");
      this.callId = callDocRef.id;
      const offerCandidates = callDocRef.collection('offerCandidates');
      const answerCandidates = callDocRef.collection('answerCandidates');

      this.peerConnection.onicecandidate = (event) => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
      };

      //console.log("Calling  createOffer.");
      const offerDescription = await this.peerConnection.createOffer();
      //console.log("createOffer completed.");
      await this.peerConnection.setLocalDescription(offerDescription);

      //console.log("setLocalDescription completed.");
      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDocRef.set({ offer });

      // Listen for remote answer
      const unsubscribe = callDocRef.onSnapshot((snapshot: { data: () => any; }) => {
        //console.log("listing remote changes");
        const data = snapshot.data();
        if (!this.peerConnection.currentRemoteDescription && data?.answer) {
          //console.log("listened remote changes");
          const answerDescription = new RTCSessionDescription(data.answer);
          this.peerConnection.setRemoteDescription(answerDescription);
          unsubscribe(); // Unsubscribe from further snapshot changes
        }
      });

      emailjs.send(environment.SERVICE_ID, environment.DOCTOR_TEMPLATE_ID,{
        meetingId : this.callId,
        to_email: this.patientEmail,
      }, environment.USER_ID)
      .then((response:any) => {
        console.log('Email sent successfully!', response);
      })
      .catch((error:any) => {
        console.error('Email could not be sent:', error);
      }); 
      console.log("this.callId",this.callId);
      // When answered, add candidate to peer connection
      answerCandidates.onSnapshot((snapshot: { docChanges: () => any[]; }) => {
        //console.log("adding remote changes");
        snapshot.docChanges().forEach((change: { type: string; doc: { data: () => RTCIceCandidateInit | undefined; }; }) => {
          if (change.type === 'added') {
            //console.log("adding candidate.");
            const candidate = new RTCIceCandidate(change.doc.data());
            //console.log(candidate);
            this.peerConnection.addIceCandidate(candidate);
            //console.log(this.peerConnection);
            
          }
        });
      });
      //console.log("InitiaeCall completed.");

      this.listenForCallEnd(this.callId);

    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  listenForCallEnd(id:any) {
    // Assuming you have the callId stored somewhere in your component
    console.log("listenForCallEnd called");
    // Call the service method to get the call document
    const callDocRef = this.firebaseService.getCallDocument(id);

    // Subscribe to changes in the call document
    this.callEndSubscription = callDocRef.valueChanges().subscribe((callData: any) => {
      if (callData.ended) {
        // Call has ended, perform necessary tasks here
        console.log('Call ended by Patient');
        this.ngZone.run(() => {
          alert('Call ended by Patient');
        });
        this.callEndedByPatient();
        // Redirect or perform other actions as needed
      }
    });

    
  }

  callEndedByPatient() {
    // Clean up resources when the component is destroyed
    console.log("callEndedByPatient");
    this.peerConnection.close();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    this.router.navigate(['/dashboardDoctor']);
  }

  async answerCall() {
    try {
      console.log("answerCall");
      console.log('callid',this.callId);

      if (!this.callId) {
        console.error("Call ID is empty");
        return;
      }
      const callDocRef = this.firebaseService.getCallDocument(this.callId);
      // const callDocRef = this.firestore.collection('calls').doc(this.callId);
      const answerCandidates = callDocRef.collection('answerCandidates');
      const offerCandidates = callDocRef.collection('offerCandidates');

      this.peerConnection.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
      };
  
      console.log("Retrieving call data");

      let c_id;
      let offer:CallData;

      // const docRef = this.firestore.collection('calls').doc(this.callId);
      // const d = docRef.get().subscribe((docSnapshot) => {
      //   console.log("docSnapshot", docSnapshot);
      //   console.log("hello");
      //   if (!docSnapshot.exists) {
      //     console.error("Call document does not exist");
      //     return;
      //   }
      //   // Handle the document data here if it exists
      //   const data = docSnapshot.data();
      //   console.log("Document data:", data);
      // });

  
      callDocRef.get().subscribe((callSnapshot) => {
        if (!callSnapshot.exists) {
          console.error("Call document does not exist");
          return;
        }
  
        const callData = callSnapshot.data() as CallData;
        console.log("callData:");
        console.log(callData);

        if (!callData || !callData.offer) {
          console.error("Offer description is missing");
          return;
        }
  
        const offerDescription = callData.offer;
        console.log("offerDescription:");
        console.log(offerDescription);
  
        if (!offerDescription) {
          console.error("Offer description is missing");
          return;
        }
  
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription))
          .then(() => {
            this.peerConnection.createAnswer()
              .then((answerDescription) => {
                this.peerConnection.setLocalDescription(answerDescription)
                  .then(() => {
                    const answer = {
                      type: answerDescription.type,
                      sdp: answerDescription.sdp,
                    };
                    console.log("answer:");
                    console.log(answer);
  
                    callDocRef.update({ answer });
                    console.log("callDocRef:");
                    console.log(callDocRef);
  
                    offerCandidates.snapshotChanges().subscribe((snapshot) => {
                      snapshot.forEach((change) => {
                        console.log("offerCandidates change");
                        if (change.type === 'added') {
                          console.log("offerCandidates added");
                          const data = change.payload.doc.data();
                          console.log(data);
                          this.peerConnection.addIceCandidate(new RTCIceCandidate(data));
                          console.log(this.peerConnection);
                        }
                      });
                    });
                    this.isRemote = true;
                    console.log("Answering call completed");
                  })
                  .catch((error) => {
                    console.error('Error setting local description:', error);
                  });
              })
              .catch((error) => {
                console.error('Error creating answer:', error);
              });
          })
          .catch((error) => {
            console.error('Error setting remote description:', error);
          });
      });
    } catch (error) {
      console.error('Error answering call:', error);
    }
  }

  
}