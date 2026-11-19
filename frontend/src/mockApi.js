// Frontend Mock API Interceptor for Chartered Mentor Demo Mode
// Intercepts window.fetch calls when localStorage.getItem('cmDemoMode') === 'true'

const enableMockApi = () => {
  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString();

  // Create list of 15 realistic mock students
  const mockStudentsList = [
    {
      _id: "s1",
      userId: "CM.STUD001",
      name: "Arjun Mehta",
      email: "arjun.mehta@gmail.com",
      phone: "+91 98765 43210",
      course: "FINAL",
      mode: "residential",
      batch: "November 2026",
      joiningDate: "2026-01-05",
      totalFees: 95000,
      feesPaid: 65000,
      installments: [
        { amount: 35000, status: "Paid", dueDate: "2026-01-10", paidDate: "2026-01-09" },
        { amount: 30000, status: "Paid", dueDate: "2026-04-10", paidDate: "2026-04-08" },
        { amount: 30000, status: "Pending", dueDate: "2026-07-10" }
      ],
      feeHistory: [
        { _id: "p11", amount: 35000, status: "Verified", date: "2026-01-09", installmentNumber: 1, receiptNo: "REC-2026-001" },
        { _id: "p12", amount: 30000, status: "Verified", date: "2026-04-08", installmentNumber: 2, receiptNo: "REC-2026-104" }
      ],
      profileCompleted: true,
      currentStatus: "Inside"
    },
    {
      _id: "s2",
      userId: "CM.STUD002",
      name: "Preeti Sharma",
      email: "preeti.sharma@yahoo.com",
      phone: "+91 87654 32109",
      course: "INTER",
      mode: "residential",
      batch: "September 2026",
      joiningDate: "2026-02-15",
      totalFees: 75000,
      feesPaid: 75000,
      installments: [
        { amount: 40000, status: "Paid", dueDate: "2026-02-20", paidDate: "2026-02-18" },
        { amount: 35000, status: "Paid", dueDate: "2026-05-20", paidDate: "2026-05-19" }
      ],
      feeHistory: [
        { _id: "p21", amount: 40000, status: "Verified", date: "2026-02-18", installmentNumber: 1, receiptNo: "REC-2026-042" },
        { _id: "p22", amount: 35000, status: "Verified", date: "2026-05-19", installmentNumber: 2, receiptNo: "REC-2026-149" }
      ],
      profileCompleted: true,
      currentStatus: "Outside"
    },
    {
      _id: "s3",
      userId: "CM.STUD003",
      name: "Rohan Das",
      email: "rohan.das@gmail.com",
      phone: "+91 76543 21098",
      course: "FINAL",
      mode: "day-scholar",
      batch: "November 2026",
      joiningDate: "2026-01-15",
      totalFees: 90000,
      feesPaid: 30000,
      installments: [
        { amount: 30000, status: "Paid", dueDate: "2026-01-20", paidDate: "2026-01-19" },
        { amount: 30000, status: "Pending", dueDate: "2026-04-20" },
        { amount: 30000, status: "Pending", dueDate: "2026-07-20" }
      ],
      feeHistory: [
        { _id: "p31", amount: 30000, status: "Verified", date: "2026-01-19", installmentNumber: 1, receiptNo: "REC-2026-012" }
      ],
      profileCompleted: true,
      currentStatus: "Outside"
    },
    {
      _id: "s4",
      userId: "CM.STUD004",
      name: "Sneha Paul",
      email: "sneha.paul@outlook.com",
      phone: "+91 95432 10987",
      course: "FOUNDATION",
      mode: "residential",
      batch: "December 2026",
      joiningDate: "2026-03-01",
      totalFees: 45000,
      feesPaid: 45000,
      installments: [
        { amount: 45000, status: "Paid", dueDate: "2026-03-05", paidDate: "2026-03-04" }
      ],
      feeHistory: [
        { _id: "p41", amount: 45000, status: "Verified", date: "2026-03-04", installmentNumber: 1, receiptNo: "REC-2026-068" }
      ],
      profileCompleted: true,
      currentStatus: "Outside"
    },
    {
      _id: "s5",
      userId: "CM.STUD005",
      name: "Karthik Nair",
      email: "karthik.nair@gmail.com",
      phone: "+91 84321 09876",
      course: "INTER",
      mode: "day-scholar",
      batch: "September 2026",
      joiningDate: "2026-02-10",
      totalFees: 75000,
      feesPaid: 50000,
      installments: [
        { amount: 25000, status: "Paid", dueDate: "2026-02-15", paidDate: "2026-02-14" },
        { amount: 25000, status: "Paid", dueDate: "2026-04-15", paidDate: "2026-04-14" },
        { amount: 25000, status: "Pending", dueDate: "2026-07-15" }
      ],
      feeHistory: [
        { _id: "p51", amount: 25000, status: "Verified", date: "2026-02-14", installmentNumber: 1, receiptNo: "REC-2026-031" },
        { _id: "p52", amount: 25000, status: "Verified", date: "2026-04-14", installmentNumber: 2, receiptNo: "REC-2026-112" }
      ],
      profileCompleted: true,
      currentStatus: "Outside"
    },
    { _id: "s6", userId: "CM.STUD006", name: "Diya Sen", email: "diya.sen@gmail.com", phone: "+91 93210 98765", course: "FINAL", mode: "residential", batch: "November 2026", joiningDate: "2026-01-10", totalFees: 95000, feesPaid: 95000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s7", userId: "CM.STUD007", name: "Manoj Kumar", email: "manoj.k@gmail.com", phone: "+91 82109 87654", course: "INTER", mode: "day-scholar", batch: "September 2026", joiningDate: "2026-03-15", totalFees: 75000, feesPaid: 25000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s8", userId: "CM.STUD008", name: "Ananya Iyer", email: "ananya.iyer@gmail.com", phone: "+91 91098 76543", course: "FOUNDATION", mode: "residential", batch: "December 2026", joiningDate: "2026-04-01", totalFees: 45000, feesPaid: 15000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s9", userId: "CM.STUD009", name: "Vikram Rathore", email: "vikram.r@gmail.com", phone: "+91 80987 65432", course: "FINAL", mode: "residential", batch: "November 2026", joiningDate: "2026-01-20", totalFees: 95000, feesPaid: 65000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s10", userId: "CM.STUD010", name: "Meera Pillai", email: "meera.pillai@gmail.com", phone: "+91 99876 54321", course: "INTER", mode: "day-scholar", batch: "September 2026", joiningDate: "2026-02-28", totalFees: 75000, feesPaid: 50000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s11", userId: "CM.STUD011", name: "Harish Rao", email: "harish.rao@yahoo.com", phone: "+91 88765 43210", course: "FINAL", mode: "residential", batch: "November 2026", joiningDate: "2026-01-05", totalFees: 95000, feesPaid: 95000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s12", userId: "CM.STUD012", name: "Shreya Ghoshal", email: "shreya.g@gmail.com", phone: "+91 77654 32109", course: "INTER", mode: "residential", batch: "September 2026", joiningDate: "2026-03-05", totalFees: 75000, feesPaid: 75000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s13", userId: "CM.STUD013", name: "Aditya Verma", email: "aditya.v@gmail.com", phone: "+91 96543 21098", course: "FINAL", mode: "day-scholar", batch: "November 2026", joiningDate: "2026-02-01", totalFees: 90000, feesPaid: 30000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s14", userId: "CM.STUD014", name: "Pooja Hegde", email: "pooja.h@gmail.com", phone: "+91 85432 10987", course: "FOUNDATION", mode: "residential", batch: "December 2026", joiningDate: "2026-04-10", totalFees: 45000, feesPaid: 45000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" },
    { _id: "s15", userId: "CM.STUD015", name: "Nitin Saxena", email: "nitin.s@gmail.com", phone: "+91 74321 09876", course: "INTER", mode: "day-scholar", batch: "September 2026", joiningDate: "2026-03-20", totalFees: 75000, feesPaid: 25000, installments: [], feeHistory: [], profileCompleted: true, currentStatus: "Outside" }
  ];

  // Create active exam sheets / schedules
  const mockPapers = [
    {
      _id: "p1",
      title: "CA Final - Financial Reporting (FR) Mock 1",
      fileName: "CA_Final_FR_Mock1.pdf",
      scheduledTime: `${todayStr}T00:00:00Z`,
      examDuration: 180,
      uploadDuration: 30,
      createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      target: "CM.STUD001",
      startTime: null,
      answerUploadedAt: null
    },
    {
      _id: "p2",
      title: "CA Final - Advanced Auditing Mock 2",
      fileName: "CA_Final_Auditing_Mock2.pdf",
      scheduledTime: `${todayStr}T00:00:00Z`,
      examDuration: 180,
      uploadDuration: 30,
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      target: "CM.STUD001",
      startTime: new Date(Date.now() - 15 * 600000).toISOString(), // started 150 mins ago
      answerUploadedAt: null
    },
    {
      _id: "p3",
      title: "CA Final - Direct Tax Laws Mock 3",
      fileName: "CA_Final_DT_Mock3.pdf",
      scheduledTime: new Date(Date.now() + 24 * 3600000).toISOString(), // tomorrow
      examDuration: 180,
      uploadDuration: 30,
      createdAt: new Date().toISOString(),
      target: "CM.STUD001",
      startTime: null,
      answerUploadedAt: null
    },
    {
      _id: "p4",
      title: "CA Final - Strategic Financial Management (SFM) Mock 4",
      fileName: "CA_Final_SFM_Mock4.pdf",
      scheduledTime: new Date(Date.now() - 48 * 3600000).toISOString(), // 2 days ago
      examDuration: 180,
      uploadDuration: 30,
      createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      target: "CM.STUD001",
      startTime: new Date(Date.now() - 50 * 3600000).toISOString(),
      answerUploadedAt: new Date(Date.now() - 47 * 3600000).toISOString(),
      answerFileName: "SFM_AnswerSheet_ArjunMehta.pdf"
    }
  ];

  const mockSchedules = [
    {
      _id: "sch1",
      title: "CA Final - 6 Month Preparation Strategy & Planner",
      fileName: "CA_Final_6_Month_Strategy.pdf",
      createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString()
    },
    {
      _id: "sch2",
      title: "Daily Study Tracker Sheet & Syllabus Milestones",
      fileName: "Daily_Study_Tracker.xlsx",
      createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
    }
  ];

  const mockExamSchedules = [
    { _id: "es1", studentId: "CM.STUD001", type: "Exam", date: `${todayStr}T09:30:00.000Z`, examName: "Financial Reporting (FR) Comprehensive Test" },
    { _id: "es2", studentId: "CM.STUD001", type: "Exam", date: new Date(Date.now() + 3 * 24 * 3600000).toISOString(), examName: "Strategic Financial Management Mock Exam" },
    { _id: "es3", studentId: "CM.STUD002", type: "Exam", date: `${todayStr}T10:00:00.000Z`, examName: "CA Inter Group 1 Accounting Test" }
  ];

  // Initialize Demo Data in localStorage if not already present
  const initDemoData = () => {
    if (localStorage.getItem('cm_demo_initialized_v3') === 'true') {
      return;
    }

    const students = [...mockStudentsList];
    const logs = [];
    const aggregates = [];
    const today = new Date();

    // Loop through each student
    students.forEach((student) => {
      // Generate last 30 days of logs (excluding Sundays)
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateStr = getLocalDateString(date);

        // Skip Sunday
        if (date.getDay() === 0) continue;

        const isToday = (i === 0);

        if (isToday) {
          if (student.userId === "CM.STUD001") {
            // Arjun Mehta is currently checked in today
            const morningIn = new Date(`${dateStr}T08:15:00`);
            const lunchOut = new Date(`${dateStr}T13:00:00`);
            const lunchIn = new Date(`${dateStr}T14:00:00`);

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: "08:15:00 AM",
              type: "IN",
              timestamp: morningIn.toISOString(),
              createdAt: morningIn.toISOString()
            });

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: "01:00:00 PM",
              type: "OUT",
              timestamp: lunchOut.toISOString(),
              createdAt: lunchOut.toISOString()
            });

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: "02:00:00 PM",
              type: "IN",
              timestamp: lunchIn.toISOString(),
              createdAt: lunchIn.toISOString()
            });

            // Calculate total hours completed so far today
            const morningMs = lunchOut.getTime() - morningIn.getTime();
            const afternoonMs = Date.now() - lunchIn.getTime();
            const totalMs = morningMs + Math.max(0, afternoonMs);
            const totalHours = totalMs / 3600000;

            aggregates.push({
              studentId: student.userId,
              studentName: student.name,
              course: student.course,
              date: dateStr,
              status: "Present",
              totalHours: Number(totalHours.toFixed(2)),
              firstIn: morningIn.toISOString(),
              lastOut: null,
              hasOUT: false
            });

            student.currentStatus = "Inside";
          } else {
            // Some students are present, some absent today
            const isAbsent = (student.userId === "CM.STUD007" || student.userId === "CM.STUD013");
            if (isAbsent) {
              aggregates.push({
                studentId: student.userId,
                studentName: student.name,
                course: student.course,
                date: dateStr,
                status: "Absent",
                totalHours: 0,
                firstIn: null,
                lastOut: null,
                hasOUT: false
              });
              student.currentStatus = "Outside";
            } else {
              const inTime = new Date(`${dateStr}T08:30:00`);
              const outTime = new Date(`${dateStr}T18:00:00`);
              logs.push({
                studentId: student.userId,
                course: student.course,
                date: dateStr,
                time: "08:30:00 AM",
                type: "IN",
                timestamp: inTime.toISOString(),
                createdAt: inTime.toISOString()
              });
              logs.push({
                studentId: student.userId,
                course: student.course,
                date: dateStr,
                time: "06:00:00 PM",
                type: "OUT",
                timestamp: outTime.toISOString(),
                createdAt: outTime.toISOString()
              });

              aggregates.push({
                studentId: student.userId,
                studentName: student.name,
                course: student.course,
                date: dateStr,
                status: "Present",
                totalHours: 9.5,
                firstIn: inTime.toISOString(),
                lastOut: outTime.toISOString(),
                hasOUT: true
              });
              student.currentStatus = "Outside";
            }
          }
        } else {
          // Past days
          const isAbsent = Math.random() < 0.08;
          if (isAbsent) {
            aggregates.push({
              studentId: student.userId,
              studentName: student.name,
              course: student.course,
              date: dateStr,
              status: "Absent",
              totalHours: 0,
              firstIn: null,
              lastOut: null,
              hasOUT: false
            });
          } else {
            // Generate morning IN, lunch OUT, lunch IN, final OUT
            const inHour1 = 8;
            const inMin1 = 10 + (student.userId.charCodeAt(student.userId.length - 1) * 3) % 25; // 8:10 to 8:35
            const outHour1 = 13;
            const outMin1 = (student.userId.charCodeAt(student.userId.length - 1) * 7) % 15; // 1:00 to 1:15
            const inHour2 = 14;
            const inMin2 = (student.userId.charCodeAt(student.userId.length - 1) * 11) % 15; // 2:00 to 2:15
            const outHour2 = 18 + (student.userId.charCodeAt(student.userId.length - 1) * 13) % 4; // 6 PM to 9 PM
            const outMin2 = (student.userId.charCodeAt(student.userId.length - 1) * 17) % 60;

            const inTime1 = new Date(`${dateStr}T${String(inHour1).padStart(2, '0')}:${String(inMin1).padStart(2, '0')}:00`);
            const outTime1 = new Date(`${dateStr}T${String(outHour1).padStart(2, '0')}:${String(outMin1).padStart(2, '0')}:00`);
            const inTime2 = new Date(`${dateStr}T${String(inHour2).padStart(2, '0')}:${String(inMin2).padStart(2, '0')}:00`);
            const outTime2 = new Date(`${dateStr}T${String(outHour2).padStart(2, '0')}:${String(outMin2).padStart(2, '0')}:00`);

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: inTime1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: "IN",
              timestamp: inTime1.toISOString(),
              createdAt: inTime1.toISOString()
            });

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: outTime1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: "OUT",
              timestamp: outTime1.toISOString(),
              createdAt: outTime1.toISOString()
            });

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: inTime2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: "IN",
              timestamp: inTime2.toISOString(),
              createdAt: inTime2.toISOString()
            });

            logs.push({
              studentId: student.userId,
              course: student.course,
              date: dateStr,
              time: outTime2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              type: "OUT",
              timestamp: outTime2.toISOString(),
              createdAt: outTime2.toISOString()
            });

            const morningMs = outTime1.getTime() - inTime1.getTime();
            const afternoonMs = outTime2.getTime() - inTime2.getTime();
            const totalMs = morningMs + afternoonMs;
            const totalHours = totalMs / 3600000;

            aggregates.push({
              studentId: student.userId,
              studentName: student.name,
              course: student.course,
              date: dateStr,
              status: "Present",
              totalHours: Number(totalHours.toFixed(2)),
              firstIn: inTime1.toISOString(),
              lastOut: outTime2.toISOString(),
              hasOUT: true
            });
          }
        }
      }
    });

    localStorage.setItem('cm_demo_students', JSON.stringify(students));
    localStorage.setItem('cm_demo_logs', JSON.stringify(logs));
    localStorage.setItem('cm_demo_aggregates', JSON.stringify(aggregates));
    localStorage.setItem('cm_demo_papers', JSON.stringify(mockPapers));
    localStorage.setItem('cm_demo_schedules', JSON.stringify(mockSchedules));
    localStorage.setItem('cm_demo_exam_schedules', JSON.stringify(mockExamSchedules));
    localStorage.setItem('cm_demo_goal_config', JSON.stringify({
      monday: 12,
      tuesday: 12,
      wednesday: 12,
      thursday: 12,
      friday: 12,
      saturday: 10,
      sunday: 0,
      autoLogoutTime: '22:30',
      autoLogoutEnabled: true
    }));
    localStorage.setItem('cm_demo_payment_config', JSON.stringify({
      upiId: "charteredmentor@upi",
      qrCodeImage: "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg",
      bankDetails: "Chartered Mentor Cochin, HDFC Bank, Acc No: 50200048392019, IFSC: HDFC0000120"
    }));
    localStorage.setItem('cm_demo_initialized_v3', 'true');
  };

  // State Getters and Setters
  const getDemoStudents = () => JSON.parse(localStorage.getItem('cm_demo_students') || '[]');
  const getDemoLogs = () => JSON.parse(localStorage.getItem('cm_demo_logs') || '[]');
  const getDemoAggregates = () => JSON.parse(localStorage.getItem('cm_demo_aggregates') || '[]');
  const getDemoPapers = () => JSON.parse(localStorage.getItem('cm_demo_papers') || '[]');
  const getDemoSchedules = () => JSON.parse(localStorage.getItem('cm_demo_schedules') || '[]');
  const getDemoExamSchedules = () => JSON.parse(localStorage.getItem('cm_demo_exam_schedules') || '[]');

  const saveDemoStudents = (data) => localStorage.setItem('cm_demo_students', JSON.stringify(data));
  const saveDemoLogs = (data) => localStorage.setItem('cm_demo_logs', JSON.stringify(data));
  const saveDemoAggregates = (data) => localStorage.setItem('cm_demo_aggregates', JSON.stringify(data));
  const saveDemoPapers = (data) => localStorage.setItem('cm_demo_papers', JSON.stringify(data));
  const saveDemoSchedules = (data) => localStorage.setItem('cm_demo_schedules', JSON.stringify(data));
  const saveDemoExamSchedules = (data) => localStorage.setItem('cm_demo_exam_schedules', JSON.stringify(data));

  // Initialize
  initDemoData();

  // Capture original fetch
  const originalFetch = window.fetch;

  // Intercept fetch
  window.fetch = async function(resource, init) {
    if (localStorage.getItem('cmDemoMode') !== 'true') {
      return originalFetch(resource, init);
    }

    const url = typeof resource === 'string' ? resource : resource.url;
    console.log(`[Demo API Mock Intercept] Requesting: ${url}`);

    // Helper to simulate successful JSON response
    const jsonResponse = (data, status = 200) => {
      return Promise.resolve(new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
      }));
    };

    // Helper to simulate text response
    const textResponse = (text, status = 200) => {
      return Promise.resolve(new Response(text, {
        status,
        headers: { 'Content-Type': 'text/plain' }
      }));
    };

    // --- 1. LOGIN MOCKS ---
    if (url.includes('/admin/login') || url.includes('/student/login')) {
      const isAdmin = url.includes('/admin');
      const body = JSON.parse(init.body);
      const userId = body.userId || (isAdmin ? "CM.ADMIN" : "CM.STUD001");
      
      const students = getDemoStudents();
      const matchedStudent = students.find(s => s.userId === userId.toUpperCase() || s.email.toLowerCase() === userId.toLowerCase());

      const responseData = {
        token: "demo-jwt-token-123456789-secret",
        role: isAdmin ? "admin" : "student",
        studentId: matchedStudent ? matchedStudent.userId : (isAdmin ? 'CM.ADMIN' : 'CM.STUD001'),
        userId: matchedStudent ? matchedStudent.userId : (isAdmin ? 'CM.ADMIN' : 'CM.STUD001'),
        name: isAdmin ? "Demo Administrator" : (matchedStudent ? matchedStudent.name : "Arjun Mehta"),
        firstLogin: false
      };
      return jsonResponse(responseData);
    }

    // Forgot password flow mocks
    if (url.includes('/student/forgot-password')) {
      return jsonResponse({ message: "A 6-digit OTP has been sent to your registered email" });
    }
    if (url.includes('/student/reset-password')) {
      return jsonResponse({ message: "Password reset successfully. You can now login." });
    }
    if (url.includes('/student/change-password')) {
      return jsonResponse({ message: "Password updated successfully" });
    }

    // --- 2. ADMIN PORTAL MOCKS ---
    if (url.includes('/admin/daily-summary')) {
      const aggregates = getDemoAggregates();
      // Return only present records to match the real backend's behavior
      const presentAggregates = aggregates.filter(a => a.status === "Present");
      return jsonResponse(presentAggregates);
    }

    if (url.includes('/admin/students')) {
      return jsonResponse(getDemoStudents());
    }

    if (url.includes('/admin/add-student')) {
      const body = JSON.parse(init.body);
      const { name, email, course, mode, batch } = body;
      const students = getDemoStudents();

      const newId = `CM.STUD${String(students.length + 1).padStart(3, '0')}`;
      const newStudentObj = {
        _id: `s${students.length + 1}`,
        userId: newId,
        name,
        email,
        phone: "+91 98765 00000",
        course,
        mode,
        batch,
        joiningDate: todayStr,
        totalFees: course === "FINAL" ? 95000 : course === "INTER" ? 75000 : 45000,
        feesPaid: 0,
        installments: [],
        feeHistory: [],
        profileCompleted: false,
        currentStatus: "Outside"
      };

      students.push(newStudentObj);
      saveDemoStudents(students);

      // Generate a mock attendance record for today (Absent as they just joined)
      const aggregates = getDemoAggregates();
      aggregates.push({
        studentId: newId,
        studentName: name,
        course,
        date: todayStr,
        status: "Absent",
        totalHours: 0,
        firstIn: null,
        lastOut: null,
        hasOUT: false
      });
      saveDemoAggregates(aggregates);

      return jsonResponse({ message: "Student created successfully", userId: newId });
    }

    if (url.includes('/admin/student/') && init.method === 'DELETE') {
      const parts = url.split('/');
      const studentId = parts[parts.length - 1];

      let students = getDemoStudents();
      students = students.filter(s => s.userId !== studentId);
      saveDemoStudents(students);

      let logs = getDemoLogs();
      logs = logs.filter(l => l.studentId !== studentId);
      saveDemoLogs(logs);

      let aggregates = getDemoAggregates();
      aggregates = aggregates.filter(a => a.studentId !== studentId);
      saveDemoAggregates(aggregates);

      return jsonResponse({ message: "Student deleted successfully!" });
    }

    if (url.includes('/admin/student/') && url.includes('/reset-password')) {
      return jsonResponse({ message: "Password has been reset!", newPassword: "growhigh_reset" });
    }

    if (url.includes('/admin/student/') && url.includes('/reset-device')) {
      const parts = url.split('/');
      const studentId = parts[3];
      const students = getDemoStudents();
      const s = students.find(x => x.userId === studentId);
      if (s) {
        s.deviceFingerprint = null;
        saveDemoStudents(students);
      }
      return jsonResponse({ message: "Device lock reset successfully!" });
    }

    if (url.includes('/admin/attendance/manual-checkout')) {
      const body = JSON.parse(init.body);
      const { studentId, date, checkoutTime } = body;

      const students = getDemoStudents();
      const student = students.find(s => s.userId === studentId);
      if (!student) {
        return jsonResponse({ message: "Student not found" }, 404);
      }

      const logs = getDemoLogs();
      const aggregates = getDemoAggregates();

      const dayLogs = logs.filter(log => log.studentId === studentId && log.date === date);
      const lastInLog = dayLogs.find(log => log.type === "IN");

      if (!lastInLog) {
        return jsonResponse({ message: "No check-in log found for this student on this day." }, 400);
      }

      const checkoutDate = new Date(`${date}T${checkoutTime}:00`);

      let outLog = logs.find(log => log.studentId === studentId && log.date === date && log.type === "OUT");
      if (outLog) {
        outLog.timestamp = checkoutDate.toISOString();
        outLog.createdAt = checkoutDate.toISOString();
        outLog.time = checkoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } else {
        logs.push({
          studentId,
          course: student.course,
          date,
          time: checkoutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: "OUT",
          timestamp: checkoutDate.toISOString(),
          createdAt: checkoutDate.toISOString()
        });
      }
      saveDemoLogs(logs);

      // Re-calculate aggregates
      const updatedDayLogs = logs.filter(log => log.studentId === studentId && log.date === date);
      let totalMs = 0;
      let lastInTime = null;
      let firstIn = null;

      updatedDayLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      updatedDayLogs.forEach(log => {
        const logTime = new Date(log.timestamp).getTime();
        if (log.type === "IN") {
          if (lastInTime === null) {
            lastInTime = logTime;
          }
          if (firstIn === null) {
            firstIn = log.timestamp;
          }
        } else if (log.type === "OUT") {
          if (lastInTime !== null) {
            totalMs += Math.max(0, logTime - lastInTime);
            lastInTime = null;
          }
        }
      });

      if (lastInTime !== null) {
        if (date === todayStr) {
          totalMs += Math.max(0, Date.now() - lastInTime);
        } else {
          totalMs += Math.max(0, checkoutDate.getTime() - lastInTime);
        }
      }

      const totalHours = totalMs / 3600000;

      let aggIndex = aggregates.findIndex(a => a.studentId === studentId && a.date === date);
      const aggData = {
        studentId,
        studentName: student.name,
        course: student.course,
        date,
        status: "Present",
        totalHours: Number(totalHours.toFixed(2)),
        firstIn: firstIn,
        lastOut: checkoutDate.toISOString(),
        hasOUT: true
      };

      if (aggIndex >= 0) {
        aggregates[aggIndex] = aggData;
      } else {
        aggregates.push(aggData);
      }
      saveDemoAggregates(aggregates);

      if (date === todayStr) {
        student.currentStatus = "Outside";
        saveDemoStudents(students);
      }

      return jsonResponse({ message: "Check-out marked successfully!" });
    }

    if (url.includes('/admin/attendance')) {
      const parsedUrl = new URL(url, window.location.origin);
      const studentId = parsedUrl.searchParams.get('studentId');
      if (studentId) {
        const logs = getDemoLogs();
        const studDetailedLogs = logs.filter(log => log.studentId === studentId);
        return jsonResponse(studDetailedLogs);
      }
      return jsonResponse(getDemoLogs());
    }

    if (url.includes('/admin/profile') || url.includes('/student/profile')) {
      const isPost = init && init.method === 'POST';
      if (isPost) {
        const body = JSON.parse(init.body);
        const { userId } = body;
        
        const students = getDemoStudents();
        const studentIndex = students.findIndex(s => s.userId === userId);
        if (studentIndex >= 0) {
          students[studentIndex] = {
            ...students[studentIndex],
            ...body,
            profileCompleted: true
          };
          saveDemoStudents(students);
        }
        return jsonResponse({ message: "Mock profile updated successfully!" });
      }

      const isStudent = localStorage.getItem('cmUser') && JSON.parse(localStorage.getItem('cmUser')).role === 'student';
      if (isStudent) {
        const cmUser = JSON.parse(localStorage.getItem('cmUser') || '{}');
        const students = getDemoStudents();
        const stud = students.find(s => s.userId === cmUser.userId) || students[0];
        return jsonResponse(stud);
      } else {
        return jsonResponse({
          name: "Demo Administrator",
          email: "admin@charteredmentor.com",
          phone: "+91 99999 88888",
          role: "admin"
        });
      }
    }

    if (url.includes('/admin/papers') || url.includes('/student/papers')) {
      return jsonResponse(getDemoPapers());
    }

    if (url.includes('/admin/upload-paper')) {
      const title = init.body.get('title');
      const target = init.body.get('target');
      const examDuration = parseInt(init.body.get('examDuration') || '180');
      const uploadDuration = parseInt(init.body.get('uploadDuration') || '15');
      const scheduledTime = init.body.get('scheduledTime');
      const file = init.body.get('file');

      const papers = getDemoPapers();
      const newPaper = {
        _id: `p${papers.length + 1}`,
        title,
        fileName: file ? file.name : "uploaded_paper.pdf",
        scheduledTime,
        examDuration,
        uploadDuration,
        createdAt: new Date().toISOString(),
        target,
        startTime: null,
        answerUploadedAt: null
      };
      papers.push(newPaper);
      saveDemoPapers(papers);

      return jsonResponse({ message: "Question Paper scheduled successfully!" });
    }

    if (url.includes('/admin/paper/') && init.method === 'DELETE') {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      let papers = getDemoPapers();
      papers = papers.filter(p => p._id !== id);
      saveDemoPapers(papers);
      return jsonResponse({ message: "Question Paper deleted successfully!" });
    }

    if (url.includes('/admin/schedules') || url.includes('/student/schedules')) {
      return jsonResponse(getDemoSchedules());
    }

    if (url.includes('/admin/schedule') && init.method === 'POST') {
      const title = init.body.get('title');
      const target = init.body.get('target');
      const date = init.body.get('date');
      const file = init.body.get('file');

      const schedules = getDemoSchedules();
      const newSchedule = {
        _id: `sch${schedules.length + 1}`,
        title,
        fileName: file ? file.name : "uploaded_schedule.pdf",
        target,
        date,
        createdAt: new Date().toISOString()
      };
      schedules.push(newSchedule);
      saveDemoSchedules(schedules);

      return jsonResponse({ message: "Schedule uploaded successfully!" });
    }

    if (url.includes('/admin/schedule/') && init.method === 'DELETE') {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      let schedules = getDemoSchedules();
      schedules = schedules.filter(s => s._id !== id);
      saveDemoSchedules(schedules);
      return jsonResponse({ message: "Schedule deleted successfully!" });
    }

    if (url.includes('/admin/exam-schedules') || url.includes('/student/exam-schedules')) {
      if (init && init.method === 'POST') {
        const body = JSON.parse(init.body);
        const { studentId, type, date, examName } = body;

        const examSchedules = getDemoExamSchedules();
        const newExamSchedule = {
          _id: `es${examSchedules.length + 1}`,
          studentId,
          type,
          date,
          examName
        };
        examSchedules.push(newExamSchedule);
        saveDemoExamSchedules(examSchedules);

        return jsonResponse({ message: "Exam scheduled successfully!" });
      }
      return jsonResponse(getDemoExamSchedules());
    }

    if (url.includes('/admin/exam-schedules/') && init.method === 'PUT') {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      const body = JSON.parse(init.body);
      const { date, examName } = body;

      const examSchedules = getDemoExamSchedules();
      const es = examSchedules.find(e => e._id === id);
      if (es) {
        es.date = date;
        es.examName = examName;
        saveDemoExamSchedules(examSchedules);
      }
      return jsonResponse({ message: "Updated successfully!" });
    }

    if (url.includes('/admin/exam-schedules/') && init.method === 'DELETE') {
      const parts = url.split('/');
      const id = parts[parts.length - 1];

      let examSchedules = getDemoExamSchedules();
      examSchedules = examSchedules.filter(e => e._id !== id);
      saveDemoExamSchedules(examSchedules);

      return jsonResponse({ message: "Deleted successfully!" });
    }

    if (url.includes('/admin/campus-qr')) {
      return jsonResponse({
        activeInToken: "CM-ATTENDANCE-IN-DEMO-" + Math.floor(Date.now() / 15000),
        activeOutToken: "CM-ATTENDANCE-OUT-DEMO-" + Math.floor(Date.now() / 15000)
      });
    }

    if (url.includes('/admin/campus-qr/refresh')) {
      return jsonResponse({
        activeInToken: "CM-ATTENDANCE-IN-DEMO-" + Math.floor(Date.now() / 15000),
        activeOutToken: "CM-ATTENDANCE-OUT-DEMO-" + Math.floor(Date.now() / 15000)
      });
    }

    if (url.includes('/admin/goal-config') || url.includes('/student/goal-config')) {
      const activeStr = localStorage.getItem('cm_demo_goal_config');
      let active = activeStr ? JSON.parse(activeStr) : {
        monday: 12, tuesday: 12, wednesday: 12, thursday: 12, friday: 12, saturday: 10, sunday: 0,
        autoLogoutTime: '22:30', autoLogoutEnabled: true
      };

      const configsStr = localStorage.getItem('cm_demo_goal_configs');
      let configs = configsStr ? JSON.parse(configsStr) : [];

      if (configs.length === 0) {
        configs.push({
          _id: "demo-goal-default",
          studentId: null,
          effectiveFrom: "1970-01-01",
          ...active
        });
        localStorage.setItem('cm_demo_goal_configs', JSON.stringify(configs));
      }

      if (init && init.method === 'POST') {
        const body = JSON.parse(init.body);
        const { studentId, monday, tuesday, wednesday, thursday, friday, saturday, sunday, autoLogoutEnabled, autoLogoutTime } = body;
        
        const todayStr = new Date().toISOString().split("T")[0];
        const cleanStudentId = studentId ? studentId.trim().toUpperCase() : null;

        let idx = configs.findIndex(c => c.studentId === cleanStudentId && c.effectiveFrom === todayStr);

        const updateData = {
          monday: monday !== undefined ? Number(monday) : 12,
          tuesday: tuesday !== undefined ? Number(tuesday) : 12,
          wednesday: wednesday !== undefined ? Number(wednesday) : 12,
          thursday: thursday !== undefined ? Number(thursday) : 12,
          friday: friday !== undefined ? Number(friday) : 12,
          saturday: saturday !== undefined ? Number(saturday) : 12,
          sunday: sunday !== undefined ? Number(sunday) : 0
        };

        if (!cleanStudentId) {
          if (autoLogoutEnabled !== undefined) updateData.autoLogoutEnabled = autoLogoutEnabled;
          if (autoLogoutTime !== undefined) updateData.autoLogoutTime = autoLogoutTime;
        }

        const newConf = {
          _id: idx >= 0 ? configs[idx]._id : "demo-goal-" + Math.random().toString(36).substr(2, 9),
          studentId: cleanStudentId,
          effectiveFrom: todayStr,
          ...updateData
        };

        if (idx >= 0) {
          configs[idx] = newConf;
        } else {
          configs.push(newConf);
        }

        localStorage.setItem('cm_demo_goal_configs', JSON.stringify(configs));

        let resolvedActive = null;
        const cmUser = JSON.parse(localStorage.getItem('cmUser') || '{}');
        const role = cmUser.role || 'admin';
        
        if (role === 'student') {
          const studentConfigs = configs.filter(c => c.studentId === cmUser.userId);
          studentConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
          resolvedActive = studentConfigs.find(c => c.effectiveFrom <= todayStr);
        }
        
        if (!resolvedActive) {
          const defaultConfigs = configs.filter(c => !c.studentId);
          defaultConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
          resolvedActive = defaultConfigs.find(c => c.effectiveFrom <= todayStr) || defaultConfigs[defaultConfigs.length - 1];
        }

        localStorage.setItem('cm_demo_goal_config', JSON.stringify(resolvedActive));

        return jsonResponse({ message: "Goal configuration saved successfully", config: newConf });
      }

      if (init && init.method === 'DELETE') {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        
        configs = configs.filter(c => c._id !== id);
        localStorage.setItem('cm_demo_goal_configs', JSON.stringify(configs));
        return jsonResponse({ message: "Goal configuration deleted successfully" });
      }

      // GET method
      let resolvedActive = null;
      const todayStr = new Date().toISOString().split("T")[0];
      const cmUser = JSON.parse(localStorage.getItem('cmUser') || '{}');
      const role = cmUser.role || 'admin';
      
      if (role === 'student') {
        const studentConfigs = configs.filter(c => c.studentId === cmUser.userId);
        studentConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        resolvedActive = studentConfigs.find(c => c.effectiveFrom <= todayStr);
      }

      if (!resolvedActive) {
        const defaultConfigs = configs.filter(c => !c.studentId);
        defaultConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        resolvedActive = defaultConfigs.find(c => c.effectiveFrom <= todayStr) || defaultConfigs[defaultConfigs.length - 1];
      }

      let filteredConfigs = configs;
      if (role === 'student') {
        filteredConfigs = configs.filter(c => !c.studentId || c.studentId === cmUser.userId);
      }

      return jsonResponse({
        active: resolvedActive,
        configs: filteredConfigs
      });
    }

    if (url.includes('/admin/payment-config') || url.includes('/student/payment-config')) {
      return jsonResponse(JSON.parse(localStorage.getItem('cm_demo_payment_config')));
    }

    // --- 3. STUDENT PORTAL MOCKS ---
    if (url.includes('/student/dashboard/')) {
      const parts = url.split('/');
      const studentId = parts[parts.length - 1];

      const students = getDemoStudents();
      const stud = students.find(s => s.userId === studentId) || students[0];

      const aggregates = getDemoAggregates();
      const logs = getDemoLogs();

      const studLogs = aggregates.filter(log => log.studentId === stud.userId);
      const studDetailedLogs = logs.filter(log => log.studentId === stud.userId);
      const todayLogsFiltered = studDetailedLogs.filter(log => log.date === todayStr);

      const responseData = {
        name: stud.name,
        email: stud.email,
        phone: stud.phone,
        course: stud.course,
        mode: stud.mode,
        batch: stud.batch,
        joiningDate: stud.joiningDate,
        totalFees: stud.totalFees,
        feesPaid: stud.feesPaid,
        installments: stud.installments,
        feeHistory: stud.feeHistory,
        profileCompleted: stud.profileCompleted !== undefined ? stud.profileCompleted : true,
        nextPaymentDueDate: "2026-07-10",
        todayLogs: todayLogsFiltered,
        attendanceSummary: studLogs
      };
      return jsonResponse(responseData);
    }

    if (url.includes('/student/attendance-history')) {
      const cmUser = JSON.parse(localStorage.getItem('cmUser') || '{}');
      const studentId = cmUser.userId || "CM.STUD001";

      const logs = getDemoLogs();
      const studDetailedLogs = logs.filter(log => log.studentId === studentId);
      return jsonResponse(studDetailedLogs);
    }

    if (url.includes('/student/paper/') && url.includes('/start')) {
      const parts = url.split('/');
      const paperId = parts[3];
      const papers = getDemoPapers();
      const paper = papers.find(p => p._id === paperId);
      if (paper) {
        paper.startTime = new Date().toISOString();
        saveDemoPapers(papers);
      }
      return jsonResponse({ message: "Exam started! Download the paper to begin." });
    }

    if (url.includes('/student/paper/') && url.includes('/download')) {
      // Return a blank PDF blob
      const pdfBlob = new Blob(["%PDF-1.4 Mock PDF Content"], { type: "application/pdf" });
      return Promise.resolve(new Response(pdfBlob, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' }
      }));
    }

    if (url.includes('/student/paper/') && url.includes('/submit-answer')) {
      const parts = url.split('/');
      const paperId = parts[3];
      const body = JSON.parse(init.body);
      const { answerFileName } = body;

      const papers = getDemoPapers();
      const paper = papers.find(p => p._id === paperId);
      if (paper) {
        paper.answerUploadedAt = new Date().toISOString();
        paper.answerFileName = answerFileName || "Answer_Sheet_Submitted.pdf";
        saveDemoPapers(papers);
      }
      return jsonResponse({ message: "Answer sheet uploaded successfully!" });
    }

    if (url.includes('/student/scan-qr') || url.includes('/student/manual-attendance')) {
      const body = JSON.parse(init.body);
      const studentId = body.studentId;
      const qrValue = body.qrValue;
      const action = body.action;

      const students = getDemoStudents();
      const student = students.find(s => s.userId === studentId);
      if (!student) {
        return jsonResponse({ message: "Student not found" }, 404);
      }

      let type;
      if (action) {
        type = action;
      } else {
        if (qrValue === "CM-ATTENDANCE-IN" || qrValue.startsWith("CM-ATTENDANCE-IN-DEMO")) type = "IN";
        else if (qrValue === "CM-ATTENDANCE-OUT" || qrValue.startsWith("CM-ATTENDANCE-OUT-DEMO")) type = "OUT";
        else return jsonResponse({ message: "Invalid or expired QR code" }, 400);
      }

      const logs = getDemoLogs();
      const aggregates = getDemoAggregates();

      const todayLogs = logs.filter(log => log.studentId === studentId && log.date === todayStr);
      const lastLog = todayLogs.length > 0 ? todayLogs[todayLogs.length - 1] : null;

      if (type === "IN") {
        if (lastLog && lastLog.type === "IN") {
          return jsonResponse({ message: "You are already Checked IN!" }, 400);
        }
      } else if (type === "OUT") {
        if (!lastLog || lastLog.type === "OUT") {
          return jsonResponse({ message: "You must Check IN first before Checking OUT!" }, 400);
        }
      }

      const now = new Date();
      const newLog = {
        studentId,
        course: student.course,
        date: todayStr,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type,
        timestamp: now.toISOString(),
        createdAt: now.toISOString()
      };
      logs.push(newLog);
      saveDemoLogs(logs);

      const updatedTodayLogs = logs.filter(log => log.studentId === studentId && log.date === todayStr);
      let totalMs = 0;
      let lastInTime = null;
      let firstIn = null;

      updatedTodayLogs.forEach(log => {
        const logTime = new Date(log.timestamp).getTime();
        if (log.type === "IN") {
          if (lastInTime === null) {
            lastInTime = logTime;
          }
          if (firstIn === null) {
            firstIn = log.timestamp;
          }
        } else if (log.type === "OUT") {
          if (lastInTime !== null) {
            totalMs += Math.max(0, logTime - lastInTime);
            lastInTime = null;
          }
        }
      });

      if (lastInTime !== null) {
        totalMs += Math.max(0, Date.now() - lastInTime);
      }

      const totalHours = totalMs / 3600000;

      let aggIndex = aggregates.findIndex(a => a.studentId === studentId && a.date === todayStr);
      const aggData = {
        studentId,
        studentName: student.name,
        course: student.course,
        date: todayStr,
        status: "Present",
        totalHours: Number(totalHours.toFixed(2)),
        firstIn: firstIn,
        lastOut: type === "OUT" ? now.toISOString() : null,
        hasOUT: type === "OUT"
      };

      if (aggIndex >= 0) {
        aggregates[aggIndex] = aggData;
      } else {
        aggregates.push(aggData);
      }
      saveDemoAggregates(aggregates);

      student.currentStatus = (type === "IN" ? "Inside" : "Outside");
      saveDemoStudents(students);

      return jsonResponse({
        message: `Attendance ${type} marked successfully`,
        type,
        timestamp: now.toISOString()
      });
    }

    // Default fallback to real API if not explicitly handled
    return originalFetch(resource, init);
  };
};

// Enable mock API interceptor always so it's ready if demo mode is activated
enableMockApi();

export { enableMockApi };
