import React, { useState } from 'react';
import api from '../../services/api';

export default function CloudinaryUpload({
  module,
  accept,
  employeeId,
  recordId,
  documentType,
  onUploaded,
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage('');
    setError('');
    try {
      const response = await api.uploadFile(file, module, {
        employeeId,
        recordId,
        documentType,
      });
      setMessage(`${file.name} uploaded to Cloudinary.`);
      onUploaded?.(response.data);
      event.target.value = '';
    } catch (uploadError) {
      setError(uploadError?.data?.message || uploadError.message || 'Upload failed.');
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <input
        type="file"
        accept={accept}
        disabled={uploading}
        onChange={handleChange}
        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-60"
      />
      {uploading && <p className="text-xs text-slate-500">Uploading to Cloudinary...</p>}
      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
