import { useEffect, useRef, useState } from "react";
import { labels } from "./components/getLabels";
import * as faceapi from 'face-api.js';
import { IMG_FORMAT } from "./components/config";

function App() {

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Please open the camera');
  const [detected, setDetected] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureVideo, setCaptureVideo] = useState(false);
  const [detectedFace, setDetectedFace] = useState(null);
  const [cameraStart, setCameraStart] = useState(false);

  const [resumeDetection, setResume] = useState(true);

  const videoRef = useRef();
  const videoHeight = 480;
  const videoWidth = 640;
  const canvasRef = useRef();

  const effectRan = useRef(false);

  useEffect(() => {
    if (ready) {
      setStatus("Ready to scan");
    }

    else {
      if (cameraStart) {
        if (detected) {
          setStatus('Hello');
        }

        else {
          setStatus('Loading faces');
        }
      }

      else {
        setStatus("Please open the camera")
      }
    }
  }, [ready, detected, cameraStart]);


  useEffect(() => {
    if (effectRan.current) return;

    const loadModels = async () => {
      const MODEL_URL = import.meta.env.BASE_URL + '/models';

      Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.mtcnn.loadFromUri(MODEL_URL)
      ]).then(setModelsLoaded(true));
    }

    loadModels();

    effectRan.current = true;

    return () => {
      effectRan.current = false;
    };
  }, []);

  useEffect(() => {
    if (detectedFace != null) {
      faceRecognized();
    }

  }, [detectedFace]);

  const faceRecognized = async () => {
    setDetected(true);
    setReady(false);

    setTimeout(() => {
      setDetectedFace(null);
      setDetected(false);
      setReady(true);
      setResume(true);
    }, 3000);
  }

  const startVideo = () => {
    if (cameraStart) {
      window.location.reload();
    }

    else {
      setCameraStart(true);
      setCaptureVideo(true);
      navigator.mediaDevices
        .getUserMedia({ video: { width: 300 } })
        .then(stream => {
          let video = videoRef.current;
          video.srcObject = stream;
          video.play();
        })
        .catch(err => {
          console.error("error:", err);
        });
    }
  }

  async function getLabeledFaceDescriptions() {

    return Promise.all(
      labels.map(async (label) => {
        const descriptions = [];

        const imageUrl = `${import.meta.env.BASE_URL}faces/${label}.${IMG_FORMAT}`;

        const img = await faceapi.fetchImage(imageUrl);

        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
        return new faceapi.LabeledFaceDescriptors(label, descriptions);
      })
    );
  }

  const handleVideoOnPlay = async () => {

    const labeledFaceDescriptors = await getLabeledFaceDescriptions();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    setStatus('Face Scanner is ready!');
    setReady(true);

    setInterval(async () => {
      if (canvasRef && canvasRef.current && resumeDetection) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const displaySize = {
          width: videoWidth,
          height: videoHeight
        };

        faceapi.matchDimensions(canvas, displaySize);

        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        const results = resizedDetections.map((d) => {
          return faceMatcher.findBestMatch(d.descriptor);
        });

        context.clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resizedDetections);

        if (results.length > 0) {
          if (results[0]["distance"] < 0.4 && results[0]._label != "unknown") {
            await Promise.all([
              setResume(false),
              setDetectedFace(results[0]._label)
            ]);

          }
        }
      }
    }, 1000);

  }

  return (
    <>
      <div className="flex flex-col h-screen">
        <div className="m-3 text-3xl font-bold text-center text-sky-500">
          Simple Face Recognition
        </div>

        <div className="flex-grow w-screen">
          <div className="p-5 flex gap-5 h-full">
            <div className="w-full">
              <div className="bg-white rounded-lg border border-sky-500 h-full">
                <div className='flex flex-col gap-5'>

                  {captureVideo ?
                    modelsLoaded ?
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
                          <video ref={videoRef} id="camera" className='w-full' onPlay={handleVideoOnPlay} style={{ borderRadius: '10px' }} />
                          <canvas ref={canvasRef} style={{ position: 'absolute' }} />
                        </div>
                      </div>
                      : <img src={loading} width={100} alt="loading" />
                    : null
                  }
                </div>

                <div className='flex flex-col align-end p-2'>

                  {
                    !cameraStart &&
                    (
                      <button className='w-full h-full justify-center bg-blue-500 p-5 rounded text-white font-semi text-2xl' onClick={startVideo}>
                        Open Camera
                      </button>
                    )
                  }
                </div>
              </div>
            </div>

            <div className="w-full">
              <div className={"flex flex-col justify-center rounded-lg borde h-full text-center " + (ready ? 'bg-sky-500 border-sky-500' : (detected ? 'bg-green-500 border-green-500' : 'bg-orange-500 border-orange-500'))}>

                <div className="text-6xl font-bold text-white p-5">
                  {status}

                  <div className="mt-3">
                    {detectedFace}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>

  )
}

export default App;
