// --- FIREBASE CONFIGURATION ---
// ¡IMPORTANTE! Reemplaza estos valores con los de tu proyecto de Firebase
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const isFirebaseConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

if (isFirebaseConfigured && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = isFirebaseConfigured ? firebase.database() : null;

// --- STATE MANAGEMENT ---
let appState = {
    activeView: 'students', // 'students' | 'plans'
    activeMonthId: null,
    activeRoutineId: null,
    showingRoutineDetail: false
};

let gymData = {
    months: [], // { id, name, students: [{id, name, day, schedule, gender, amount, paid}] }
    routines: [] // { id, name, date, exercises: [{id, exercise, sets, reps}] }
};

let genderChartInstance = null;
let daysChartInstance = null;
let timesChartInstance = null;
let pendingConfirmAction = null;

// --- DOM ELEMENTS ---
// Navigation
const navBtns = document.querySelectorAll('.nav-btn');
const viewStudents = document.getElementById('view-students');
const viewPlans = document.getElementById('view-plans');
const sidebarMonths = document.getElementById('sidebar-months');

// Students View - General
const stateNoMonth = document.getElementById('state-no-month');
const studentsContent = document.getElementById('students-content');
const headerMonthTitle = document.getElementById('header-month-title');
const monthsList = document.getElementById('months-list');
const formAddMonth = document.getElementById('form-add-month');
const inputMonthName = document.getElementById('input-month-name');

// Students View - Dashboard & Form
const statRevenue = document.getElementById('stat-revenue');
const statTotalStudents = document.getElementById('stat-total-students');
const ctxChart = document.getElementById('gender-chart');
const formAddStudent = document.getElementById('form-add-student');
const tableStudentsBody = document.getElementById('table-students-body');
const emptyStudents = document.getElementById('empty-students');

// Plans View
const routinesListView = document.getElementById('routines-list-view');
const routineDetailView = document.getElementById('routine-detail-view');
const btnOpenCreateRoutine = document.getElementById('btn-open-create-routine');
const btnBackToRoutines = document.getElementById('btn-back-to-routines');
const routinesGrid = document.getElementById('routines-grid');
const emptyRoutines = document.getElementById('empty-routines');

// Plans Detail View
const detailRoutineName = document.getElementById('detail-routine-name');
const detailRoutineDate = document.getElementById('detail-routine-date');
const formAddExercise = document.getElementById('form-add-exercise');
const tableExercisesBody = document.getElementById('table-exercises-body');
const emptyExercises = document.getElementById('empty-exercises');

// Modals
const modalEditStudent = document.getElementById('modal-edit-student');
const formEditStudent = document.getElementById('form-edit-student');
const modalEditExercise = document.getElementById('modal-edit-exercise');
const formEditExercise = document.getElementById('form-edit-exercise');
const modalCreateRoutine = document.getElementById('modal-create-routine');
const formCreateRoutine = document.getElementById('form-create-routine');
const modalConfirm = document.getElementById('modal-confirm');

// --- INIT & PERSISTENCE ---
function init() {
    setupEventListeners();
    try { document.getElementById('create-routine-date').value = new Date().toISOString().split('T')[0]; } catch(e){}
    
    if (isFirebaseConfigured) {
        db.ref('gymDataPro').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) gymData = data;
            
            if (!gymData.months) gymData.months = [];
            if (!gymData.routines) gymData.routines = [];
            
            if (!appState.activeMonthId && gymData.months.length > 0) {
                appState.activeMonthId = gymData.months[0].id;
            }
            renderApp();
        });
    } else {
        console.warn("Firebase no configurado. Usando almacenamiento local.");
        const stored = localStorage.getItem('gymDataPro');
        if (stored) {
            try { gymData = JSON.parse(stored); } catch (e) {}
        }
        if (!gymData.months) gymData.months = [];
        if (!gymData.routines) gymData.routines = [];
        
        if (gymData.months.length > 0 && !appState.activeMonthId) {
            appState.activeMonthId = gymData.months[0].id;
        }
        renderApp();
    }
}

function saveData() {
    if (isFirebaseConfigured) {
        db.ref('gymDataPro').set(gymData);
    } else {
        localStorage.setItem('gymDataPro', JSON.stringify(gymData));
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
});

// --- CORE RENDERING LOGIC ---
function renderApp() {
    // 1. Navigation state
    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-target') === appState.activeView);
    });

    if (appState.activeView === 'students') {
        viewStudents.classList.remove('hidden');
        viewPlans.classList.add('hidden');
        sidebarMonths.classList.remove('hidden');
        renderStudentsModule();
    } else {
        viewStudents.classList.add('hidden');
        viewPlans.classList.remove('hidden');
        sidebarMonths.classList.add('hidden');
        renderPlansModule();
    }
}

// --- STUDENTS MODULE ---
function renderStudentsModule() {
    renderMonthsList();
    
    const activeMonth = getActiveMonth();
    
    if (!activeMonth) {
        stateNoMonth.classList.remove('hidden');
        studentsContent.classList.add('hidden');
        headerMonthTitle.textContent = "Ningún mes seleccionado";
    } else {
        stateNoMonth.classList.add('hidden');
        studentsContent.classList.remove('hidden');
        headerMonthTitle.textContent = activeMonth.name;
        
        renderStudentsTable();
        updateDashboard(activeMonth);
    }
}

function getActiveMonth() {
    if (!appState.activeMonthId) return null;
    return gymData.months.find(m => m.id === appState.activeMonthId) || null;
}

function renderMonthsList() {
    monthsList.innerHTML = '';
    gymData.months.forEach(month => {
        const div = document.createElement('div');
        div.className = `month-item ${month.id === appState.activeMonthId ? 'active' : ''}`;
        
        div.innerHTML = `
            <span class="month-name" style="flex:1;">${month.name}</span>
            <button class="btn-icon delete btn-delete-month" title="Eliminar mes">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        
        div.querySelector('.month-name').addEventListener('click', () => {
            appState.activeMonthId = month.id;
            renderApp();
        });
        
        div.querySelector('.btn-delete-month').addEventListener('click', (e) => {
            e.stopPropagation();
            requestConfirm('Eliminar Mes', 'Se borrará el mes y todos sus alumnos.', () => {
                gymData.months = gymData.months.filter(m => m.id !== month.id);
                if (appState.activeMonthId === month.id) {
                    appState.activeMonthId = gymData.months.length > 0 ? gymData.months[0].id : null;
                }
                saveData();
                renderApp();
            });
        });
        
        monthsList.appendChild(div);
    });
}

function renderStudentsTable() {
    tableStudentsBody.innerHTML = '';
    const month = getActiveMonth();
    if (!month) return;
    
    if (month.students.length === 0) {
        emptyStudents.classList.remove('hidden');
        tableStudentsBody.parentElement.classList.add('hidden');
    } else {
        emptyStudents.classList.add('hidden');
        tableStudentsBody.parentElement.classList.remove('hidden');
        
        month.students.forEach(student => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${student.name}</strong><br>
                    <span class="badge ${student.gender}">${student.gender}</span>
                </td>
                <td>${(student.days && student.days.length > 0) ? student.days.join(', ') : (student.day || 'Lunes')}</td>
                <td>${student.schedule}</td>
                <td><strong>${currencyFormatter.format(student.amount)}</strong></td>
                <td>
                    <label class="custom-checkbox">
                        <input type="checkbox" class="payment-toggle" data-id="${student.id}" ${student.paid ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn-icon btn-edit-student" data-id="${student.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn-icon delete btn-delete-student" data-id="${student.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </td>
            `;
            tableStudentsBody.appendChild(tr);
        });

        // Attach events
        document.querySelectorAll('.payment-toggle').forEach(el => {
            el.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                togglePayment(id, e.target.checked);
            });
        });

        document.querySelectorAll('.btn-delete-student').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                requestConfirm('Eliminar Alumno', '¿Quitar este alumno del mes?', () => {
                    const month = getActiveMonth();
                    month.students = month.students.filter(s => s.id !== id);
                    saveData();
                    renderApp();
                });
            });
        });

        document.querySelectorAll('.btn-edit-student').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const month = getActiveMonth();
                const student = month.students.find(s => s.id === id);
                if (student) {
                    document.getElementById('edit-student-id').value = student.id;
                    document.getElementById('edit-student-name').value = student.name;
                    const studentDays = student.days ? student.days : (student.day ? [student.day] : ['Lunes']);
                    document.querySelectorAll('#edit-student-days input').forEach(cb => {
                        cb.checked = studentDays.includes(cb.value);
                    });
                    document.getElementById('edit-student-schedule').value = student.schedule;
                    document.getElementById('edit-student-gender').value = student.gender;
                    document.getElementById('edit-student-amount').value = student.amount;
                    openModal(modalEditStudent);
                }
            });
        });
    }
}

function updateDashboard(month) {
    const total = month.students.length;
    statTotalStudents.textContent = total;
    
    const revenue = month.students
        .filter(s => s.paid)
        .reduce((sum, s) => sum + s.amount, 0);
    statRevenue.textContent = currencyFormatter.format(revenue);
    
    // Charts Data Prep
    let h = 0, m = 0, o = 0;
    const daysCount = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0 };

    month.students.forEach(s => {
        // Gender
        if (s.gender === 'Hombre') h++;
        else if (s.gender === 'Mujer') m++;
        else o++;
        
        // Days
        const sDays = s.days ? s.days : (s.day ? [s.day] : ['Lunes']);
        sDays.forEach(d => {
            if (daysCount[d] !== undefined) daysCount[d]++;
        });
    });
    
    // Destroy previous instances
    if (genderChartInstance) genderChartInstance.destroy();
    if (daysChartInstance) daysChartInstance.destroy();
    
    if (total > 0 && typeof Chart !== 'undefined') {
        const ctxGender = document.getElementById('gender-chart');
        genderChartInstance = new Chart(ctxGender, {
            type: 'doughnut',
            data: {
                labels: ['Hombres', 'Mujeres', 'Otros'],
                datasets: [{
                    data: [h, m, o],
                    backgroundColor: ['#4A7AAB', '#FFFFFF', '#888888'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#AAAAAA', boxWidth: 12 } }
                },
                cutout: '75%'
            }
        });

        const ctxDays = document.getElementById('days-chart');
        daysChartInstance = new Chart(ctxDays, {
            type: 'doughnut',
            data: {
                labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                datasets: [{
                    data: [daysCount['Lunes'], daysCount['Martes'], daysCount['Miércoles'], daysCount['Jueves'], daysCount['Viernes'], daysCount['Sábado']],
                    backgroundColor: ['#4A7AAB', '#5C8EBF', '#6D9FD3', '#A0C2E6', '#FFFFFF', '#AAAAAA'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#AAAAAA', boxWidth: 12 } }
                },
                cutout: '75%'
            }
        });
    }
}

function togglePayment(id, isPaid) {
    const month = getActiveMonth();
    const student = month.students.find(s => s.id === id);
    if (student) {
        student.paid = isPaid;
        saveData();
        updateDashboard(month); // Only update dashboard to avoid re-rendering entire table
    }
}

// --- PLANS MODULE ---
function renderPlansModule() {
    if (appState.showingRoutineDetail && appState.activeRoutineId) {
        routinesListView.classList.add('hidden');
        routineDetailView.classList.remove('hidden');
        btnOpenCreateRoutine.classList.add('hidden');
        btnBackToRoutines.classList.remove('hidden');
        renderRoutineDetail();
    } else {
        routinesListView.classList.remove('hidden');
        routineDetailView.classList.add('hidden');
        btnOpenCreateRoutine.classList.remove('hidden');
        btnBackToRoutines.classList.add('hidden');
        renderRoutinesList();
    }
}

function getActiveRoutine() {
    if (!appState.activeRoutineId) return null;
    return gymData.routines.find(r => r.id === appState.activeRoutineId) || null;
}

function renderRoutinesList() {
    routinesGrid.innerHTML = '';
    
    if (gymData.routines.length === 0) {
        emptyRoutines.classList.remove('hidden');
        routinesGrid.classList.add('hidden');
    } else {
        emptyRoutines.classList.add('hidden');
        routinesGrid.classList.remove('hidden');
        
        // Sort descending
        const sorted = [...gymData.routines].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        sorted.forEach(routine => {
            const card = document.createElement('div');
            card.className = 'routine-card';
            const exCount = routine.exercises ? routine.exercises.length : 0;
            
            card.innerHTML = `
                <h3>${routine.name}</h3>
                <div class="routine-stats">
                    <span>📅 ${routine.date}</span>
                    <span>💪 ${exCount} ${exCount === 1 ? 'Ejercicio' : 'Ejercicios'}</span>
                </div>
                <button class="btn-icon delete btn-delete-routine" data-id="${routine.id}">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-routine')) return;
                appState.activeRoutineId = routine.id;
                appState.showingRoutineDetail = true;
                renderApp();
            });
            
            card.querySelector('.btn-delete-routine').addEventListener('click', (e) => {
                requestConfirm('Eliminar Rutina', '¿Borrar rutina y sus ejercicios permanentemente?', () => {
                    gymData.routines = gymData.routines.filter(r => r.id !== routine.id);
                    saveData();
                    renderApp();
                });
            });
            
            routinesGrid.appendChild(card);
        });
    }
}

function renderRoutineDetail() {
    const routine = getActiveRoutine();
    if (!routine) return;
    
    detailRoutineName.textContent = routine.name;
    detailRoutineDate.textContent = routine.date;
    
    tableExercisesBody.innerHTML = '';
    
    if (!routine.exercises || routine.exercises.length === 0) {
        emptyExercises.classList.remove('hidden');
        tableExercisesBody.parentElement.classList.add('hidden');
    } else {
        emptyExercises.classList.add('hidden');
        tableExercisesBody.parentElement.classList.remove('hidden');
        
        routine.exercises.forEach(exe => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${exe.exercise}</strong></td>
                <td><span class="badge outline">${exe.sets} Series</span></td>
                <td><span class="badge outline">${exe.reps} Reps</span></td>
                <td>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn-icon btn-edit-exe" data-id="${exe.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn-icon delete btn-delete-exe" data-id="${exe.id}"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </td>
            `;
            tableExercisesBody.appendChild(tr);
        });
        
        document.querySelectorAll('.btn-delete-exe').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                requestConfirm('Quitar Ejercicio', '¿Eliminar este ejercicio de la rutina?', () => {
                    routine.exercises = routine.exercises.filter(ex => ex.id !== id);
                    saveData();
                    renderApp();
                });
            });
        });
        
        document.querySelectorAll('.btn-edit-exe').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const exe = routine.exercises.find(ex => ex.id === id);
                if (exe) {
                    document.getElementById('edit-exe-id').value = exe.id;
                    document.getElementById('edit-exe-name').value = exe.exercise;
                    document.getElementById('edit-exe-sets').value = exe.sets;
                    document.getElementById('edit-exe-reps').value = exe.reps;
                    openModal(modalEditExercise);
                }
            });
        });
    }
}

// --- MODALS & CONFIRM SYSTEM ---
function openModal(modalEl) {
    modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
    modalEl.classList.add('hidden');
}

function requestConfirm(title, msg, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = msg;
    pendingConfirmAction = onConfirm;
    openModal(modalConfirm);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            appState.activeView = e.currentTarget.getAttribute('data-target');
            if(appState.activeView === 'plans') {
                appState.showingRoutineDetail = false;
            }
            renderApp();
        });
    });

    btnBackToRoutines.addEventListener('click', () => {
        appState.showingRoutineDetail = false;
        renderApp();
    });

    // Month Creation
    formAddMonth.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = inputMonthName.value.trim();
        if (name) {
            const newMonth = { id: generateId(), name, students: [] };
            gymData.months.push(newMonth);
            appState.activeMonthId = newMonth.id;
            saveData();
            inputMonthName.value = '';
            renderApp();
        }
    });

    // Student Creation
    formAddStudent.addEventListener('submit', (e) => {
        e.preventDefault();
        const month = getActiveMonth();
        if (!month) return;
        
        const name = document.getElementById('input-student-name').value.trim();
        const dayNodes = document.querySelectorAll('#input-student-days input:checked');
        const days = Array.from(dayNodes).map(cb => cb.value);
        const schedule = document.getElementById('input-student-schedule').value.trim();
        const gender = document.getElementById('input-student-gender').value;
        const amount = parseFloat(document.getElementById('input-student-amount').value);
        
        if (name && days.length > 0 && schedule && gender && !isNaN(amount)) {
            month.students.push({
                id: generateId(),
                name, days, schedule, gender, amount, paid: false
            });
            saveData();
            formAddStudent.reset();
            document.getElementById('input-student-name').focus();
            renderApp();
        }
    });

    // Routine Creation
    btnOpenCreateRoutine.addEventListener('click', () => {
        openModal(modalCreateRoutine);
    });

    formCreateRoutine.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('create-routine-name').value.trim();
        const date = document.getElementById('create-routine-date').value;
        
        if (name && date) {
            const newRoutine = { id: generateId(), name, date, exercises: [] };
            gymData.routines.push(newRoutine);
            saveData();
            formCreateRoutine.reset();
            try { document.getElementById('create-routine-date').value = new Date().toISOString().split('T')[0]; } catch(e){}
            closeModal(modalCreateRoutine);
            renderApp();
        }
    });

    // Exercise Creation
    formAddExercise.addEventListener('submit', (e) => {
        e.preventDefault();
        const routine = getActiveRoutine();
        if (!routine) return;
        
        const exercise = document.getElementById('input-exe-name').value.trim();
        const sets = parseInt(document.getElementById('input-exe-sets').value);
        const reps = document.getElementById('input-exe-reps').value.trim();
        
        if (exercise && !isNaN(sets) && reps) {
            if (!routine.exercises) routine.exercises = [];
            routine.exercises.push({ id: generateId(), exercise, sets, reps });
            saveData();
            formAddExercise.reset();
            document.getElementById('input-exe-name').focus();
            renderApp();
        }
    });

    // Edit Student Submit
    formEditStudent.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-student-id').value;
        const month = getActiveMonth();
        const student = month.students.find(s => s.id === id);
        
        if (student) {
            student.name = document.getElementById('edit-student-name').value.trim();
            const editDayNodes = document.querySelectorAll('#edit-student-days input:checked');
            student.days = Array.from(editDayNodes).map(cb => cb.value);
            student.schedule = document.getElementById('edit-student-schedule').value.trim();
            student.gender = document.getElementById('edit-student-gender').value;
            student.amount = parseFloat(document.getElementById('edit-student-amount').value);
            saveData();
            closeModal(modalEditStudent);
            renderApp();
        }
    });

    // Edit Exercise Submit
    formEditExercise.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-exe-id').value;
        const routine = getActiveRoutine();
        const exe = routine.exercises.find(ex => ex.id === id);
        
        if (exe) {
            exe.exercise = document.getElementById('edit-exe-name').value.trim();
            exe.sets = parseInt(document.getElementById('edit-exe-sets').value);
            exe.reps = document.getElementById('edit-exe-reps').value.trim();
            saveData();
            closeModal(modalEditExercise);
            renderApp();
        }
    });

    // Confirm Modal Actions
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
        pendingConfirmAction = null;
        closeModal(modalConfirm);
    });

    document.getElementById('btn-confirm-ok').addEventListener('click', () => {
        if (pendingConfirmAction) pendingConfirmAction();
        pendingConfirmAction = null;
        closeModal(modalConfirm);
    });

    // Global Modal Closing
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            closeModal(e.target.closest('.modal'));
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });
}

// Start
init();
