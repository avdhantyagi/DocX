import React, { useCallback, useEffect, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';

// Define toolbar options
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['bold', 'italic', 'underline'],
  [{ color: [] }, { background: [] }],
  [{ script: 'sub' }, { script: 'super' }],
  [{ align: [] }],
  ['image', 'blockquote', 'code-block'],
  ['clean']
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();

  // Handle save button click
  const handleSave = () => {
    console.log('Pressed save button');
    const content = quill.getContents();
    
    // Send full document content to the server
    socket.emit('save-document', documentId, content);
  };

  // Connect to the socket server
  useEffect(() => {
    const s = io('http://localhost:5174');
    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Load document from server
  useEffect(() => {
    if (socket == null || quill == null) return;

    socket.once('load-document', (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit('get-document', documentId);
  }, [socket, quill, documentId]);

  // Handle real-time text changes and send deltas to server
  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socket.emit('send-changes', { documentId, changes: delta });
    };

    quill.on('text-change', handler);

    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, quill, documentId]);

  // Receive real-time changes from other clients
  useEffect(() => {
    if (socket == null || quill == null) return;

    const handleReceiveChanges = (delta) => {
      quill.updateContents(delta);
    };

    socket.on('receive-changes', handleReceiveChanges);

    return () => {
      socket.off('receive-changes', handleReceiveChanges);
    };
  }, [socket, quill]);

  // Create the Quill editor and attach toolbar
  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;

    wrapper.innerHTML = '';

    const editor = document.createElement('div');
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: 'snow',
      modules: { toolbar: TOOLBAR_OPTIONS }
    });

    q.disable();
    q.setText('Loading...');
    setQuill(q);
  }, []);

  // Attach save button to toolbar
  useEffect(() => {
    if (quill == null || socket == null) return;

    const toolbarContainer = document.querySelector('.ql-toolbar');
    if (toolbarContainer && !document.querySelector('.ql-save')) {
      const customButton = document.createElement('button');
      customButton.innerHTML = 'Save';
      customButton.classList.add('ql-save');

      toolbarContainer.appendChild(customButton);

      // Add event listener for the save button
      customButton.addEventListener('click', handleSave);

      // Cleanup listener when component unmounts
      return () => {
        customButton.removeEventListener('click', handleSave);
      };
    }
  }, [quill, socket, handleSave]);

  return (
    <div className="container">
      <div ref={wrapperRef}></div>
    </div>
  );
}
