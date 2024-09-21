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
  const [summary, setSummary] = useState('');

  // Handle save button click
  const handleSave = () => {
    console.log('Pressed save button');
    const content = quill.getContents();
    
    // Send full document content to the server
    socket.emit('save-document', documentId, content);
  };

  // Handle summarize button hover
  const handleSummarize = async () => {
    if (!quill) return;

    // Get all text content from the Quill editor
    const text = quill.getText().trim(); // Trim to remove any extra spaces

    if (text) {
      try {
        const response = await fetch('https://summarizeapi.onrender.com/result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        });
        const data = await response.json();
        if (data.summary) {
          setSummary(data.summary); // Update the state with the summary
          console.log('Summary:', data.summary);
        }
      } catch (error) {
        console.error('Error fetching summary:', error);
      }
    } else {
      console.log('No text available for summarization.');
    }
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

  // Attach save and summarize buttons to toolbar
  useEffect(() => {
    if (quill == null || socket == null) return;

    const toolbarContainer = document.querySelector('.ql-toolbar');
    if (toolbarContainer && !document.querySelector('.ql-save')) {
      // Save Button
      const saveButton = document.createElement('button');
      saveButton.innerHTML = 'Save';
      saveButton.classList.add('ql-save');
      toolbarContainer.appendChild(saveButton);
      saveButton.addEventListener('click', handleSave);

      // Summarize Button (on hover)
      const summarizeButton = document.createElement('button');
      summarizeButton.innerHTML = 'Summarize';
      summarizeButton.classList.add('ql-summarize');
      toolbarContainer.appendChild(summarizeButton);

      // Add event listener for the summarize button on hover
      summarizeButton.addEventListener('mouseover', handleSummarize);

      // Cleanup listeners when component unmounts
      return () => {
        saveButton.removeEventListener('click', handleSave);
        summarizeButton.removeEventListener('mouseover', handleSummarize);
      };
    }
  }, [quill, socket, handleSave, handleSummarize]);

  return (
    <div className="container">
      <div ref={wrapperRef}></div>
      {summary && (
        <div className="summary-container">
          <h3>Summary:</h3>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
