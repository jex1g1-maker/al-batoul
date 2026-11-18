// ==========================================================
// منصة صالة البتول - الربط السحابي والاحتفاظ بالجلسة
// تم التصحيح وإصلاح مشاكل تطابق الحروف وتحديث الجدول
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getDatabase, ref, set, get, update, remove, push, onValue 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 1. إعدادات فايربيز
const firebaseConfig = {
    apiKey: "AIzaSyClAci17SQy6vUDa4TLs--B_LbjW8oD418",
    authDomain: "al-batoul-60f7a.firebaseapp.com",
    databaseURL: "https://al-batoul-60f7a-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "al-batoul-60f7a",
    storageBucket: "al-batoul-60f7a.firebasestorage.app",
    messagingSenderId: "1078442618096",
    appId: "1:1078442618096:web:c6244f172a21bd8a0f6635",
};

// تهيئة السيرفر
const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

// كود الدخول الأولي للأدمن لكي يظهر حقل الباسورد
const ADMIN_CODE = "9999"; 

// متغيرات النظام
let activeStudentCode = null;
let currentSelectedStudentForGrade = null;
let currentDetailStudentCode = null;
let allStudentsCache = [];
let lastScannedCode = ""; 
let isWaitingForAdminPassword = false;
let isAdminLoggedIn = false;

// ==========================================================
// 2. تهيئة التطبيق التلقائية
// ==========================================================
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    startLiveClock();
    listenToPublicNews();
    checkSavedSession();
});

function checkSavedSession() {
    const savedRole = localStorage.getItem('eldeeb_user_role');
    const savedCode = localStorage.getItem('eldeeb_user_code');

    if (savedRole === 'admin') {
        isAdminLoggedIn = true;
        showAdminDashboard();
    } else if (savedRole === 'student' && savedCode) {
        isAdminLoggedIn = false;
        verifyAndLoadStudent(savedCode, true);
    } else {
        isAdminLoggedIn = false;
        showLoginScreen();
    }
}

// ==========================================================
// 3. نظام تسجيل الدخول (مع باسورد الأدمن)
// ==========================================================
window.processLogin = function() {
    const inputField = document.getElementById('universalCodeInput');
    const passGroup = document.getElementById('adminPasswordGroup');
    const passField = document.getElementById('adminPasswordInput');
    const errorMsg = document.getElementById('loginError');

    const code = inputField.value.trim();

    if (!code) {
        alert("يرجى إدخال الكود الرقمي الخاص بك!");
        return;
    }

    if (errorMsg) errorMsg.classList.add('hidden');

    if (code === ADMIN_CODE) {
        if (!isWaitingForAdminPassword) {
            passGroup.classList.remove('hidden');
            isWaitingForAdminPassword = true;
            return;
        } else {
            const typedPass = passField.value.trim();
            if (!typedPass) {
                alert("يرجى إدخال كلمة مرور الإدارة!");
                return;
            }

            const passRef = ref(db, 'settings/adminPassword');
            get(passRef).then((snap) => {
                if (snap.exists()) {
                    if (snap.val() === typedPass) {
                        loginAsAdmin();
                    } else {
                        if (errorMsg) {
                            errorMsg.textContent = "كلمة المرور غير صحيحة!";
                            errorMsg.classList.remove('hidden');
                        }
                    }
                } else {
                    set(passRef, typedPass).then(() => {
                        alert("تم إنشاء كلمة مرور الأدمن وحفظها بنجاح!");
                        loginAsAdmin();
                    }).catch(err => {
                        console.error("خطأ حفظ كلمة السر:", err);
                        alert("تعذر حفظ كلمة المرور! تحقق من قواعد Firebase Rules.");
                    });
                }
            }).catch(err => {
                console.error("خطأ الاتصال بفايربيز:", err);
                alert("تعذر الاتصال بفايربيز! تحقق من الشبكة أو القواعد.");
            });
        }
        return;
    }

    verifyAndLoadStudent(code, false);
};

function loginAsAdmin() {
    isAdminLoggedIn = true;
    localStorage.setItem('eldeeb_user_role', 'admin');
    localStorage.removeItem('eldeeb_user_code');
    
    document.getElementById('universalCodeInput').value = '';
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminPasswordGroup').classList.add('hidden');
    isWaitingForAdminPassword = false;
    
    showAdminDashboard();
}

function verifyAndLoadStudent(code, isAutoLogin) {
    const studentRef = ref(db, `students/${code}`);
    
    get(studentRef).then((snapshot) => {
        if (snapshot.exists()) {
            localStorage.setItem('eldeeb_user_role', 'student');
            localStorage.setItem('eldeeb_user_code', code);
            activeStudentCode = code;

            const inputField = document.getElementById('universalCodeInput');
            if (inputField) inputField.value = '';
            showStudentDashboard();

            onValue(studentRef, (snap) => {
                if (snap.exists()) {
                    renderStudentData(snap.val());
                }
            });

        } else {
            if (isAutoLogin) {
                window.logoutUser();
            } else {
                const errorMsg = document.getElementById('loginError');
                if (errorMsg) {
                    errorMsg.textContent = "الكود غير مسجل بالنظام!";
                    errorMsg.classList.remove('hidden');
                }
            }
        }
    }).catch(err => {
        console.error(err);
        alert("خطأ في الاتصال بقاعدة البيانات!");
    });
}

window.logoutUser = function() {
    localStorage.removeItem('eldeeb_user_role');
    localStorage.removeItem('eldeeb_user_code');
    activeStudentCode = null;
    isWaitingForAdminPassword = false;
    isAdminLoggedIn = false;
    
    const passGroup = document.getElementById('adminPasswordGroup');
    if(passGroup) passGroup.classList.add('hidden');

    showLoginScreen();
};

// ==========================================================
// 4. عرض واجهات الطالب (تم تصحيح اسم الدالة)
// ==========================================================
function renderStudentData(data) {
    const nameDisplay = document.getElementById('studentNameDisplay');
    const codeDisplay = document.getElementById('studentCodeDisplay');
    if (nameDisplay) nameDisplay.textContent = data.name || "طالب";
    if (codeDisplay) codeDisplay.textContent = `#${data.code} (${data.grade || 'غير محدد'})`;

    const qrImage = document.getElementById('studentQrImage');
    if (qrImage && data.code) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data.code}`;
        qrImage.style.display = 'block';
    }

    const feeBadge = document.getElementById('feeStatusBadge');
    if (feeBadge) {
        feeBadge.textContent = data.feeStatus || "غير مدفوع";
        feeBadge.style.color = (data.feeStatus === "مدفوع") ? "var(--success)" : "var(--danger)";
    }
    const feeDateEl = document.getElementById('feePaymentDate');
    if (feeDateEl) feeDateEl.textContent = data.feeDate || "لم يتم التسجيل";

    const attendanceArray = data.attendance || [];
    const actualAttendanceCount = attendanceArray.filter(a => a.status !== 'غياب').length;
    
    const countEl = document.getElementById('totalAttendanceCount');
    if (countEl) countEl.textContent = actualAttendanceCount;
    
    const attendanceList = document.getElementById('studentAttendanceList');
    if (attendanceList) {
        attendanceList.innerHTML = attendanceArray.length ? '' : '<li>لا يوجد سجل حتى الآن</li>';
        attendanceArray.slice().reverse().forEach(item => {
            const li = document.createElement('li');
            if (item.status === 'غياب') {
                li.innerHTML = `<i class="fa-solid fa-circle-xmark text-danger"></i> تم تسجيل غياب يوم: <strong>${item.date}</strong>`;
            } else {
                li.innerHTML = `<i class="fa-solid fa-check-circle text-success"></i> تم تسجيل حضور يوم: <strong>${item.date}</strong>`;
            }
            attendanceList.appendChild(li);
        });
    }

    const gradesArray = data.grades || [];
    const gradesTable = document.getElementById('studentGradesTable');
    if (gradesTable) {
        gradesTable.innerHTML = gradesArray.length ? '' : '<tr><td colspan="3">لا توجد اختبارات مسجلة بعد</td></tr>';
        gradesArray.slice().reverse().forEach(g => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${g.title}</strong></td>
                <td><span class="code-badge" style="background:rgba(59,130,246,0.2); color:#3b82f6;">${g.score}</span></td>
                <td>${g.time}</td>
            `;
            gradesTable.appendChild(tr);
        });
    }
}

// ==========================================================
// 5. وظائف لوحة الأدمن (تم تصحيح اسم المتغير المسبب للمشكلة)
// ==========================================================
function loadAdminData() {
    const studentsRef = ref(db, 'students');
    
    onValue(studentsRef, (snapshot) => {
        allStudentsCache = []; // تم تصحيح الخطأ هنا (كان مكتوباً بـ s صغيرة)
        if (snapshot.exists()) {
            const data = snapshot.val();
            for (let key in data) {
                allStudentsCache.push(data[key]);
            }
        }
        renderAdminStudentsTable(allStudentsCache);
    }, (error) => {
        console.error("خطأ قراءة بيانات الطلاب من فايربيز:", error);
        alert("⚠️ تنبيه: تم رفض قراءة بيانات الطلاب من قاعدة البيانات. يرجى مراجعة قواعد الأمان (Firebase Rules).");
    });

    const newsRef = ref(db, 'news');
    onValue(newsRef, (snapshot) => {
        const adminNewsContainer = document.getElementById('adminNewsContainer');
        if (!adminNewsContainer) return;
        adminNewsContainer.innerHTML = '';
        if (snapshot.exists()) {
            const newsData = snapshot.val();
            for (let id in newsData) {
                const item = newsData[id];
                const div = document.createElement('div');
                div.className = 'stat-card mb-15 flex-between';
                div.innerHTML = `
                    <div>
                        <p style="margin:0; font-weight:600;">${item.text}</p>
                        <small class="text-muted">${item.date}</small>
                    </div>
                    <button class="btn-outline danger" onclick="deleteNews('${id}')"><i class="fa-solid fa-trash"></i></button>
                `;
                adminNewsContainer.appendChild(div);
            }
        }
    }, (error) => {
        console.error("خطأ قراءة الأخبار:", error);
    });
}

window.changeAdminPassword = function() {
    if (!isAdminLoggedIn) {
        alert("عفواً، يجب تسجيل الدخول كأدمن لتغيير كلمة المرور!");
        return;
    }

    const newPassInput = document.getElementById('newAdminPasswordInput');
    if (!newPassInput) {
        alert("لم يتم العثور على حقل كلمة المرور الجديدة في الصفحة!");
        return;
    }

    const newPass = newPassInput.value.trim();
    if (!newPass) {
        alert("يرجى كتابة كلمة المرور الجديدة أولاً!");
        return;
    }

    const passRef = ref(db, 'settings/adminPassword');
    set(passRef, newPass).then(() => {
        alert("تم تحديث كلمة مرور الأدمن بنجاح!");
        newPassInput.value = '';
    }).catch(err => {
        console.error("خطأ أثناء التحديث:", err);
        alert("فشل تحديث كلمة المرور! تحقق من اتصال الإنترنت وقواعد فايربيز.");
    });
};

window.deleteStudent = function(code) {
    if (!isAdminLoggedIn) {
        alert("عفواً، لا تملك صلاحية حذف البيانات!");
        return;
    }

    if (confirm(`هل أنت متأكد من رغبتك في حذف الطالب رقم #${code} نهائياً؟`)) {
        remove(ref(db, `students/${code}`)).then(() => {
            alert("تم الحذف بنجاح.");
        }).catch(err => {
            alert("حدث خطأ أثناء الحذف: " + err.message);
        });
    }
};

window.addNewStudent = function() {
    const nameInput = document.getElementById('newStudentName');
    const codeInput = document.getElementById('newStudentCode');
    const phoneInput = document.getElementById('newStudentPhone');
    const parentPhoneInput = document.getElementById('newStudentParentPhone');
    const gradeInput = document.getElementById('newStudentGrade');

    const name = nameInput?.value.trim();
    const code = codeInput?.value.trim();
    const phone = phoneInput?.value.trim();
    const parentPhone = parentPhoneInput?.value.trim();
    const grade = gradeInput?.value;

    if (!name || !code || !grade) {
        alert("الاسم، الكود، والصف الدراسي بيانات إجبارية!");
        return;
    }

    const studentRef = ref(db, `students/${code}`);
    get(studentRef).then((snapshot) => {
        if (snapshot.exists()) {
            alert("هذا الكود مستخدم بالفعل لطالب آخر!");
        } else {
            const newStudentData = {
                name: name,
                code: code,
                grade: grade,
                phone: phone || "غير مسجل",
                parentPhone: parentPhone || "غير مسجل",
                feeStatus: "غير مدفوع",
                feeDate: "لم يدفع",
                attendance: [],
                grades: [],
                createdAt: Date.now()
            };

            set(studentRef, newStudentData).then(() => {
                alert(`تم تسجيل الطالب "${name}" بنجاح!`);
                if(nameInput) nameInput.value = '';
                if(codeInput) codeInput.value = '';
                if(phoneInput) phoneInput.value = '';
                if(parentPhoneInput) parentPhoneInput.value = '';
                if(gradeInput) gradeInput.selectedIndex = 0;
            }).catch(err => {
                console.error("خطأ أثناء الحفظ:", err);
                alert("تم رفض الحفظ (Permission Denied)! تأكد من أن قواعد Firebase Rules تسمح بالكتابة والقراءة.");
            });
        }
    }).catch(err => {
        console.error("خطأ أثناء قراءة البيانات:", err);
        alert("لا يمكن الاتصال بقاعدة البيانات للتحقق من الكود!");
    });
};

function renderAdminStudentsTable(students) {
    const tableBody = document.getElementById('adminStudentsListTable');
    if (!tableBody) return;
    tableBody.innerHTML = students.length ? '' : '<tr><td colspan="7" style="text-align:center; padding:20px; color:#718096;">لا يوجد طلاب مسجلين حالياً</td></tr>';

    students.forEach(student => {
        const tr = document.createElement('tr');
        const isPaid = student.feeStatus === "مدفوع";

        tr.innerHTML = `
            <td><strong class="text-accent">#${student.code}</strong></td>
            <td><strong>${student.name}</strong></td>
            <td><small class="text-muted">${student.grade || 'غير محدد'}</small></td>
            <td>
                <button class="btn-outline ${isPaid ? 'success' : 'danger'}" onclick="toggleFeeStatus('${student.code}', '${student.feeStatus}')">
                    ${isPaid ? '<i class="fa-solid fa-check"></i> مدفوع' : '<i class="fa-solid fa-xmark"></i> غير مدفوع'}
                </button>
            </td>
            <td>
                <button class="btn-outline" style="padding:4px 8px; font-size:0.8rem;" onclick="openStudentDetailsModal('${student.code}')"><i class="fa-solid fa-eye"></i> التفاصيل</button>
            </td>
            <td>
                <button class="btn-gradient success" style="padding:4px 10px; font-size:0.9rem;" onclick="sendWhatsappToParent('${student.code}')"><i class="fa-brands fa-whatsapp"></i></button>
            </td>
            <td>
                <button class="btn-gradient" style="padding:4px 8px; font-size:0.8rem;" onclick="openGradeModal('${student.code}', '${student.name}')">+ درجة</button>
                <button class="btn-outline danger" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteStudent('${student.code}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

window.openStudentDetailsModal = function(code) {
    const student = allStudentsCache.find(s => s.code === code);
    if(!student) return;
    currentDetailStudentCode = code;

    document.getElementById('detailStudentName').textContent = student.name;
    document.getElementById('detailStudentCode').textContent = `#${student.code}`;
    document.getElementById('detailStudentGrade').textContent = student.grade || 'غير محدد';
    
    const attendanceArr = student.attendance || [];
    const presentCount = attendanceArr.filter(a => a.status !== 'غياب').length;
    const absentCount = attendanceArr.filter(a => a.status === 'غياب').length;

    document.getElementById('detailAttendanceCount').textContent = presentCount;
    document.getElementById('detailAbsenceCount').textContent = absentCount;

    document.getElementById('detailStudentPhone').textContent = student.phone || 'غير مسجل';
    document.getElementById('detailParentPhone').textContent = student.parentPhone || 'غير مسجل';

    document.getElementById('studentDetailsModal').classList.remove('hidden');
};

window.closeStudentDetailsModal = function() {
    document.getElementById('studentDetailsModal').classList.add('hidden');
    currentDetailStudentCode = null;
};

window.sendWhatsappToParent = function(codeParam) {
    const targetCode = codeParam || currentDetailStudentCode;
    const student = allStudentsCache.find(s => s.code === targetCode);
    
    if (!student || !student.parentPhone || student.parentPhone === "غير مسجل") {
        alert("رقم ولي الأمر غير مسجل لهذا الطالب!");
        return;
    }

    const attendanceArr = student.attendance || [];
    const presentCount = attendanceArr.filter(a => a.status !== 'غياب').length;
    const absentCount = attendanceArr.filter(a => a.status === 'غياب').length;

    const message = `أهلاً بك ولي أمر الطالب/ة: ${student.name}
نود إعلامكم بتقرير الحضور والغياب في صالة البتول:
✅ عدد أيام الحضور: ${presentCount}
❌ عدد أيام الغياب: ${absentCount}
شكراً لمتابعتكم ونتمنى دوام التوفيق.`;
    
    let phoneNum = student.parentPhone.replace(/\D/g,'');
    if (phoneNum.startsWith('0')) {
        phoneNum = '2' + phoneNum;
    } else if (!phoneNum.startsWith('20')) {
        phoneNum = '20' + phoneNum;
    }

    const whatsappUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
};

window.filterStudents = function() {
    const searchInput = document.getElementById('searchStudentInput');
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase().trim();
    const filtered = allStudentsCache.filter(s => 
        (s.name && s.name.toLowerCase().includes(query)) || 
        (s.code && s.code.toString().includes(query)) ||
        (s.grade && s.grade.toLowerCase().includes(query))
    );
    renderAdminStudentsTable(filtered);
};

window.toggleFeeStatus = function(code, currentStatus) {
    const newStatus = (currentStatus === "مدفوع") ? "غير مدفوع" : "مدفوع";
    const dateStr = (newStatus === "مدفوع") ? new Date().toLocaleDateString('ar-EG') : "لم يدفع";

    update(ref(db, `students/${code}`), {
        feeStatus: newStatus,
        feeDate: dateStr
    });
};

window.submitQuickAttendance = function(statusType = 'حضور') {
    const input = document.getElementById('quickScanCode');
    if (!input) return;

    const code = input.value.trim();
    const resultDiv = document.getElementById('quickScanResult');

    if (!code) {
        alert("يرجى إدخال الكود أولاً!");
        return;
    }

    const studentRef = ref(db, `students/${code}`);
    get(studentRef).then((snapshot) => {
        if (snapshot.exists()) {
            const student = snapshot.val();
            const attendance = student.attendance || [];
            const now = new Date().toLocaleString('ar-EG');

            attendance.push({ date: now, status: statusType });

            update(studentRef, { attendance: attendance }).then(() => {
                if (resultDiv) {
                    if (statusType === 'حضور') {
                        resultDiv.style.color = "var(--success)";
                        resultDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> تم تسجيل حضور: <strong>${student.name}</strong>`;
                    } else {
                        resultDiv.style.color = "var(--danger)";
                        resultDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> تم تسجيل غياب: <strong>${student.name}</strong>`;
                    }
                }
                input.value = '';
                lastScannedCode = '';
            });
        } else {
            if (resultDiv) {
                resultDiv.style.color = "var(--danger)";
                resultDiv.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> الكود #${code} غير مسجل بالنظام!`;
            }
        }
    });
};

window.openGradeModal = function(code, name) {
    currentSelectedStudentForGrade = code;
    const nameEl = document.getElementById('modalGradeStudentName');
    if (nameEl) nameEl.textContent = name;
    
    document.getElementById('modalExamTitle').value = '';
    document.getElementById('modalExamScore').value = '';
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('modalExamTime').value = now.toISOString().slice(0, 16);

    document.getElementById('addGradeModal').classList.remove('hidden');
};

window.closeGradeModal = function() {
    const modal = document.getElementById('addGradeModal');
    if (modal) modal.classList.add('hidden');
    currentSelectedStudentForGrade = null;
};

window.saveGradeForStudent = function() {
    const title = document.getElementById('modalExamTitle').value.trim();
    const score = document.getElementById('modalExamScore').value.trim();
    const timeVal = document.getElementById('modalExamTime').value;

    if (!title || !score) {
        alert("يرجى إدخال عنوان الامتحان والدرجة!");
        return;
    }

    const formattedTime = timeVal ? new Date(timeVal).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
    const studentRef = ref(db, `students/${currentSelectedStudentForGrade}`);

    get(studentRef).then((snapshot) => {
        if (snapshot.exists()) {
            const student = snapshot.val();
            const grades = student.grades || [];

            grades.push({
                title: title,
                score: score,
                time: formattedTime
            });

            update(studentRef, { grades: grades }).then(() => {
                alert("تم تسجيل الدرجة بنجاح!");
                window.closeGradeModal();
            });
        }
    });
};

window.postNewNews = function() {
    const textInput = document.getElementById('newNewsText');
    const text = textInput.value.trim();

    if (!text) return;

    push(ref(db, 'news'), {
        text: text,
        date: new Date().toLocaleString('ar-EG')
    }).then(() => {
        textInput.value = '';
        alert("تم النشر بنجاح!");
    });
};

window.deleteNews = function(id) {
    if (!isAdminLoggedIn) {
        alert("عفواً، لا تملك صلاحية حذف التنبيهات!");
        return;
    }
    remove(ref(db, `news/${id}`));
};

function listenToPublicNews() {
    onValue(ref(db, 'news'), (snapshot) => {
        const feedContainer = document.getElementById('newsFeedContainer');
        if (!feedContainer) return;
        feedContainer.innerHTML = '';
        if (snapshot.exists()) {
            const newsData = snapshot.val();
            for (let id in newsData) {
                const item = newsData[id];
                const card = document.createElement('div');
                card.className = 'news-card';
                card.innerHTML = `
                    <p style="margin:0; font-weight:600;"><i class="fa-solid fa-bullhorn text-accent"></i> ${item.text}</p>
                    <small class="text-muted" style="display:block; margin-top:5px;">${item.date}</small>
                `;
                feedContainer.appendChild(card);
            }
        } else {
            feedContainer.innerHTML = '<p class="text-muted">لا توجد تنبيهات.</p>';
        }
    });
}

window.exportData = function() {
    get(ref(db)).then((snapshot) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.val() || {}));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `eldeeb_backup_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });
};

window.importData = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedJSON = JSON.parse(e.target.result);
            if (confirm("هل أنت متأكد من استبدال قاعدة البيانات بالملف المرفوع؟")) {
                set(ref(db), importedJSON).then(() => {
                    alert("تم الاسترجاع بنجاح!");
                });
            }
        } catch (err) {
            alert("ملف غير صالح!");
        }
    };
    reader.readAsText(file);
};

// ==========================================================
// 6. التبديل بين الواجهات
// ==========================================================
function showLoginScreen() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('studentDashboardSection').classList.add('hidden');
    document.getElementById('adminDashboardSection').classList.add('hidden');
}

function showStudentDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('studentDashboardSection').classList.remove('hidden');
    document.getElementById('adminDashboardSection').classList.add('hidden');
}

function showAdminDashboard() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('studentDashboardSection').classList.add('hidden');
    document.getElementById('adminDashboardSection').classList.remove('hidden');
    loadAdminData();
}

window.switchStudentTab = function(tabId, btn) {
    document.querySelectorAll('#studentDashboardSection .menu-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.student-tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
};

window.switchAdminTab = function(tabId, btn) {
    document.querySelectorAll('#adminDashboardSection .menu-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`adminTab-${tabId}`).classList.remove('hidden');
};

// ==========================================================
// 7. الساعة والمؤثرات
// ==========================================================
function startLiveClock() {
    setInterval(() => {
        const clock = document.getElementById('liveClock');
        if (clock) clock.textContent = new Date().toLocaleTimeString('ar-EG');
    }, 1000);
}

function initCanvas() {
    const canvas = document.getElementById('interactiveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    const particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6
    }));
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// ==========================================
// 8. نظام قراءة QR Code
// ==========================================
let html5QrcodeScanner = null;

window.startQRScanner = function() {
    if (typeof Html5Qrcode === 'undefined') {
        alert("لم يتم العثور على مكتبة الكاميرا!");
        return;
    }
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader");
    }
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess
    ).then(() => {
        document.getElementById("stopQrBtn").classList.remove("hidden");
        document.getElementById("captureQrBtn").classList.remove("hidden");
    }).catch(err => alert("تعذر فتح الكاميرا!"));
};

window.stopQRScanner = function() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById("stopQrBtn").classList.add("hidden");
            document.getElementById("captureQrBtn").classList.add("hidden");
        });
    }
};

function onScanSuccess(decodedTest) {
    lastScannedCode = decodedTest;
    document.getElementById("quickScanResult").innerHTML = `<span style="color: #3b82f6;">تم رصد الكود: <strong>${decodedTest}</strong> (اضغط التقاط)</span>`;
}

window.captureAndSubmitAttendance = function() {
    if (!lastScannedCode) {
        alert("وجه الكاميرا نحو الكود أولاً!");
        return;
    }
    document.getElementById("quickScanCode").value = lastScannedCode;
    window.submitQuickAttendance('حضور');
};