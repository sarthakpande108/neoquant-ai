import React, { useCallback, useRef } from 'react';

interface FileUploadProps {
  onImageUpload: (file: File) => void;
  imagePreviewUrl: string | null;
  onClear: () => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

export const FileUpload: React.FC<FileUploadProps> = ({ onImageUpload, imagePreviewUrl, onClear, isAnalyzing, onAnalyze }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        disabled={isAnalyzing}
      />
      {!imagePreviewUrl ? (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="cursor-pointer border-2 border-dashed border-slate-700 rounded-lg p-8 text-center flex flex-col items-center justify-center h-64 hover:border-sky-500 hover:bg-slate-800/50 transition-all duration-300 transform hover:-translate-y-1"
        >
            <UploadIcon/>
          <p className="mt-2 font-semibold text-slate-300">Drop your chart screenshot here</p>
          <p className="text-sm text-slate-400">or click to browse</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-2xl p-2 bg-slate-950 rounded-lg border border-slate-800">
            <img src={imagePreviewUrl} alt="Stock chart preview" className="rounded-md w-full h-auto object-contain" />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onClear}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-sky-600 text-white font-bold rounded-md hover:bg-sky-500 disabled:bg-sky-800 disabled:cursor-wait transition-colors"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Chart'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};