import React, { useState, useEffect } from 'react';
import QrScanner from 'react-qr-scanner';
import { X, QrCode } from 'lucide-react';

const QRScanner = ({ onScan, onClose, isOpen }) => {
  const [delay, setDelay] = useState(100);
  const [result, setResult] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'user' for front camera, 'environment' for back camera

  useEffect(() => {
    if (result) {
      onScan(result, 'qr');
      setResult('');
    }
  }, [result, onScan]);

  const handleScan = (data) => {
    if (data) {
      setResult(data);
    }
  };

  const handleError = (err) => {
    console.error('QR Scanner Error:', err);
  };

  const previewStyle = {
    height: 300,
    width: 300,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <QrCode className="w-6 h-6 mr-2" />
            QR-Code Scanner
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center">
          <div className="mx-auto mb-4 border-2 border-gray-300 rounded-lg overflow-hidden">
            <QrScanner
              delay={delay}
              style={previewStyle}
              onError={handleError}
              onScan={handleScan}
              facingMode={facingMode}
            />
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Halten Sie den QR-Code vor die Kamera
          </p>

          <div className="flex space-x-2 justify-center">
            <button
              onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
              className="btn btn-secondary btn-sm"
            >
              Kamera wechseln
            </button>
            <button
              onClick={onClose}
              className="btn btn-primary btn-sm"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;