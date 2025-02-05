let classes = {};

document.addEventListener('DOMContentLoaded', () => {
  // Load saved data
  chrome.storage.local.get(['classes'], (result) => {
    if (result.classes) {
      classes = result.classes;
      renderClasses();
    }
  });

  // Add class button
  document.getElementById('addClass').addEventListener('click', () => {
    const className = document.getElementById('className').value.trim();
    if (className) {
      classes[className] = {
        students: {},
        created: new Date().toISOString()
      };
      saveData();
      renderClasses();
      document.getElementById('className').value = '';
    }
  });

  // Export data button
  document.getElementById('exportData').addEventListener('click', exportToCSV);
});

function renderClasses() {
  const container = document.getElementById('classes');
  container.innerHTML = '';

  Object.keys(classes).forEach(className => {
    const classDiv = document.createElement('div');
    classDiv.className = 'class-container';
    
    // Class header with editable name
    const header = document.createElement('div');
    header.className = 'class-header';
    header.innerHTML = `
      <div class="class-title">
        <h3 class="class-name-display">${className}</h3>
        <span class="edit-icon">✏️</span>
      </div>
      <div>
        <input type="text" placeholder="Add student" class="student-input">
        <button class="add-student">Add</button>
        <button class="delete-class">Delete Class</button>
      </div>
    `;

    // Add control buttons (Start/Stop All)
    const controlButtons = document.createElement('div');
    controlButtons.className = 'control-buttons';
    controlButtons.innerHTML = `
      <button class="start-all-btn">Start All</button>
      <button class="stop-all-btn">Stop All</button>
    `;

    classDiv.appendChild(header);
    classDiv.appendChild(controlButtons);

    // Student list
    const studentList = document.createElement('div');
    Object.keys(classes[className].students).forEach(student => {
      const studentDiv = createStudentRow(className, student);
      studentList.appendChild(studentDiv);
    });
    classDiv.appendChild(studentList);

    // Event listeners
    const addStudentBtn = header.querySelector('.add-student');
    const studentInput = header.querySelector('.student-input');
    const deleteClassBtn = header.querySelector('.delete-class');
    const editIcon = header.querySelector('.edit-icon');
    const classNameDisplay = header.querySelector('.class-name-display');

    // Edit class name
    editIcon.addEventListener('click', () => {
      const currentName = classNameDisplay.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = currentName;
      input.style.width = '150px';
      
      classNameDisplay.replaceWith(input);
      input.focus();

      input.addEventListener('blur', () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          classes[newName] = classes[currentName];
          delete classes[currentName];
          saveData();
          renderClasses();
        } else {
          input.replaceWith(classNameDisplay);
        }
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          input.blur();
        }
      });
    });

    // Start/Stop All buttons
    controlButtons.querySelector('.start-all-btn').addEventListener('click', () => {
      Object.keys(classes[className].students).forEach(studentName => {
        const student = classes[className].students[studentName];
        if (!student.currentSession) {
          student.currentSession = new Date().toISOString();
        }
      });
      saveData();
      renderClasses();
    });

    controlButtons.querySelector('.stop-all-btn').addEventListener('click', () => {
      Object.keys(classes[className].students).forEach(studentName => {
        const student = classes[className].students[studentName];
        if (student.currentSession) {
          student.sessions.push({
            start: student.currentSession,
            end: new Date().toISOString()
          });
          student.currentSession = null;
        }
      });
      saveData();
      renderClasses();
    });

    addStudentBtn.addEventListener('click', () => {
      const studentName = studentInput.value.trim();
      if (studentName) {
        classes[className].students[studentName] = {
          sessions: [],
          currentSession: null
        };
        saveData();
        studentList.appendChild(createStudentRow(className, studentName));
        studentInput.value = '';
      }
    });

    deleteClassBtn.addEventListener('click', () => {
      delete classes[className];
      saveData();
      renderClasses();
    });

    container.appendChild(classDiv);
  });
}

function createStudentRow(className, studentName) {
  const div = document.createElement('div');
  div.className = 'student-row';
  
  const student = classes[className].students[studentName];
  const isTracking = student.currentSession !== null;
  
  div.innerHTML = `
    <span>${studentName}</span>
    <span class="timer">${calculateTotalTime(student.sessions)}</span>
    <div class="button-group">
      <button class="toggle-timer">${isTracking ? 'Stop' : 'Start'}</button>
      <button class="remove-student">Remove</button>
    </div>
  `;

  // Timer toggle
  div.querySelector('.toggle-timer').addEventListener('click', (e) => {
    const student = classes[className].students[studentName];
    if (student.currentSession) {
      // Stop timer
      student.sessions.push({
        start: student.currentSession,
        end: new Date().toISOString()
      });
      student.currentSession = null;
      e.target.textContent = 'Start';
    } else {
      // Start timer
      student.currentSession = new Date().toISOString();
      e.target.textContent = 'Stop';
    }
    saveData();
    div.querySelector('.timer').textContent = calculateTotalTime(student.sessions);
  });

  // Remove student
  div.querySelector('.remove-student').addEventListener('click', () => {
    delete classes[className].students[studentName];
    saveData();
    div.remove();
  });

  return div;
}

function calculateTotalTime(sessions) {
  let total = 0;
  sessions.forEach(session => {
    const start = new Date(session.start);
    const end = new Date(session.end);
    total += end - start;
  });
  return formatTime(total);
}

function formatTime(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function saveData() {
  chrome.storage.local.set({ classes });
}

function exportToCSV() {
  let csv = 'Class,Student,Session Start,Session End,Duration (minutes)\n';
  
  Object.keys(classes).forEach(className => {
    Object.keys(classes[className].students).forEach(studentName => {
      const student = classes[className].students[studentName];
      student.sessions.forEach(session => {
        const start = new Date(session.start);
        const end = new Date(session.end);
        const duration = (end - start) / (1000 * 60); // Convert to minutes
        csv += `${className},${studentName},${session.start},${session.end},${duration}\n`;
      });
    });
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}