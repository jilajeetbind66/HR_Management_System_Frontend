import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import StatCard from '../../components/common/StatCard';
import api from '../../services/api';
import { getIndiaDateString } from '../../utils/date';
import { getCurrentPositionAsync } from '../../utils/geolocation';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Upload,
  UserCheck,
  FileSpreadsheet,
  MapPin,
  Laptop,
  Download,
  Building2,
  Sliders,
  ShieldAlert,
  Sparkles,
  Filter,
} from 'lucide-react';

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toUpperCase() : null;

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

export const formatWorkDuration = (workHours, punchIn = null, punchOut = null) => {
  let totalMinutes = null;
  if (punchIn && punchOut) {
    const inMins = parseTimeToMinutes(punchIn);
    const outMins = parseTimeToMinutes(punchOut);
    if (inMins !== null && outMins !== null) {
      totalMinutes = outMins >= inMins ? outMins - inMins : (24 * 60 - inMins) + outMins;
    }
  }
  if (totalMinutes === null) {
    totalMinutes = Math.max(0, Math.round(Number(workHours || 0) * 60));
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const getWorkedMinutes = (workHours, punchIn = null, punchOut = null) => {
  if (punchIn && punchOut) {
    const inMins = parseTimeToMinutes(punchIn);
    const outMins = parseTimeToMinutes(punchOut);
    if (inMins !== null && outMins !== null) {
      return outMins >= inMins ? outMins - inMins : (24 * 60 - inMins) + outMins;
    }
  }
  return Math.max(0, Math.round(Number(workHours || 0) * 60));
};

const getShiftDutyMinutes = (shift, role = null) => {
  if (!shift) return 7 * 60;
  const isStaffShift = Boolean(
    shift.staff_shift_enabled &&
    role &&
    Array.isArray(shift.staff_applied_roles) &&
    shift.staff_applied_roles.includes(role)
  );
  const startStr = isStaffShift ? (shift.staff_start_time || '10:00 AM') : (shift.start_time || '09:30 AM');
  const endStr = isStaffShift ? (shift.staff_end_time || '07:00 PM') : (shift.end_time || '06:30 PM');
  const startMins = parseTimeToMinutes(startStr);
  const endMins = parseTimeToMinutes(endStr);
  if (startMins === null || endMins === null) return 7 * 60;
  return endMins > startMins ? endMins - startMins : (24 * 60 - startMins) + endMins;
};

const staffRolesList = [
  { id: 'manager', label: 'Managers', desc: 'Engineering & Project Managers' },
  { id: 'hr_admin', label: 'HR Admins', desc: 'Head of HR & People Operations' },
  { id: 'hr_executive', label: 'HR Executives', desc: 'HR Operations & Onboarding' },
  { id: 'recruiter', label: 'Recruiters', desc: 'Talent Acquisition Partners' },
  { id: 'payroll_admin', label: 'Payroll Specialists', desc: 'Finance & Payroll Staff' },
  { id: 'auditor', label: 'Internal Auditors', desc: 'Compliance & Audit Officers' },
];

const getLateArrivalInfo = (punchInTime, shift, role = null) => {
  if (!punchInTime || !shift) return { isLate: false, minutesLate: 0, shiftName: 'General Employee Shift', startTimeStr: '09:30 AM', graceMinutes: 15, cutoffTimeStr: '09:45 AM' };
  const punchMinutes = parseTimeToMinutes(punchInTime);
  if (punchMinutes === null) return { isLate: false, minutesLate: 0, shiftName: 'General Employee Shift', startTimeStr: '09:30 AM', graceMinutes: 15, cutoffTimeStr: '09:45 AM' };

  // Check if staff / executive custom shift applies to this role
  const isStaffShift = Boolean(
    shift.staff_shift_enabled &&
    role &&
    Array.isArray(shift.staff_applied_roles) &&
    shift.staff_applied_roles.includes(role)
  );

  const startTimeStr = isStaffShift ? (shift.staff_start_time || '10:00 AM') : (shift.start_time || '09:30 AM');
  const graceMinutes = isStaffShift ? parseInt(shift.staff_grace_period_minutes || 15, 10) : parseInt(shift.grace_period_minutes || 15, 10);
  const shiftName = isStaffShift ? (shift.staff_shift_name || 'Management & Staff Shift') : (shift.shift_name || 'General Employee Shift');

  const shiftStartMinutes = parseTimeToMinutes(startTimeStr);
  if (shiftStartMinutes === null) return { isLate: false, minutesLate: 0, shiftName, startTimeStr, graceMinutes, cutoffTimeStr: '09:45 AM' };

  const allowedCutoff = shiftStartMinutes + graceMinutes;
  const h = Math.floor(allowedCutoff / 60);
  const m = allowedCutoff % 60;
  const cutoffTimeStr = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

  if (punchMinutes > allowedCutoff) {
    return {
      isLate: true,
      minutesLate: punchMinutes - allowedCutoff,
      isStaffShift,
      shiftName,
      startTimeStr,
      graceMinutes,
      cutoffTimeStr,
    };
  }
  return {
    isLate: false,
    minutesLate: 0,
    isStaffShift,
    shiftName,
    startTimeStr,
    graceMinutes,
    cutoffTimeStr,
  };
};

export default function AttendanceView() {
  const { currentUser, activeBranch } = useAuth();
  const {
    attendance,
    punchAttendance,
    regularizationRequests,
    submitRegularization,
    reviewRegularization,
    refreshAttendance,
    employees,
    leaveRequests,
  } = useHRMS();

  const isBranchScoped = Boolean(activeBranch && activeBranch !== 'All Branches');

  const filteredAttendance = useMemo(() => {
    if (!isBranchScoped) return attendance;
    return attendance.filter((att) => {
      const emp = employees.find((e) => Number(e.id) === Number(att.employee_id));
      const branchName = emp?.branch_name || att.location;
      if (!branchName) return false;
      return (
        branchName === activeBranch ||
        (activeBranch.includes('Prayagraj') && branchName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && branchName.includes('Kaushambi'))
      );
    });
  }, [attendance, employees, activeBranch, isBranchScoped]);

  const filteredRegularization = useMemo(() => {
    if (currentUser?.role === 'employee') return regularizationRequests;
    if (!isBranchScoped) return regularizationRequests;
    return regularizationRequests.filter((req) => {
      const emp = employees.find((e) => Number(e.id) === Number(req.employee_id));
      const branchName = req.branch_name || emp?.branch_name;
      if (!branchName) return true;
      return (
        branchName === activeBranch ||
        (activeBranch.includes('Prayagraj') && branchName.includes('Prayagraj')) ||
        (activeBranch.includes('Kaushambi') && branchName.includes('Kaushambi'))
      );
    });
  }, [regularizationRequests, employees, activeBranch, isBranchScoped, currentUser?.role]);

  const [activeTab, setActiveTab] = useState(() => {
    return window.location.hash === '#regularization' ? 'regularization' : 'punches';
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#regularization') {
        setActiveTab('regularization');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);
  const [showRegModal, setShowRegModal] = useState(false);
  const [regDate, setRegDate] = useState(getIndiaDateString);
  const [regIn, setRegIn] = useState('09:15 AM');
  const [regOut, setRegOut] = useState('06:30 PM');
  const [regReason, setRegReason] = useState('');
  const [regModalError, setRegModalError] = useState('');
  const [workflowError, setWorkflowError] = useState('');
  const canManageAttendance = ['super_admin', 'hr_admin', 'hr_executive', 'manager'].includes(currentUser.role);
  const canApprove = canManageAttendance;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isEmployee = currentUser?.role === 'employee';
  const isStaffRole = !isSuperAdmin && !isEmployee;
  const [punchFeedback, setPunchFeedback] = useState(null);
  const [isPunching, setIsPunching] = useState(false);

  // Shift & Grace Period State
  const [shiftSettings, setShiftSettings] = useState({
    shift_name: 'General Employee Shift',
    start_time: '09:30 AM',
    end_time: '06:30 PM',
    grace_period_minutes: 15,
    late_mark_threshold: 3,
    auto_half_day_deduction: true,
    staff_shift_enabled: true,
    staff_shift_name: 'Management & Staff Shift',
    staff_start_time: '10:00 AM',
    staff_end_time: '07:00 PM',
    staff_grace_period_minutes: 15,
    staff_applied_roles: ['manager', 'hr_admin', 'hr_executive', 'recruiter', 'payroll_admin', 'auditor'],
  });
  const [savingShiftSettings, setSavingShiftSettings] = useState(false);
  const [shiftFeedback, setShiftFeedback] = useState(null);

  // Muster Roll Period State
  const [selectedMonth, setSelectedMonth] = useState(11); // November
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    return currentUser?.role === 'employee' && currentUser?.employee_id
      ? String(currentUser.employee_id)
      : 'all';
  });

  useEffect(() => {
    let active = true;
    api.getAttendanceShiftSettings()
      .then((res) => {
        if (active && res?.data) {
          const raw = res.data;
          setShiftSettings({
            ...raw,
            staff_applied_roles: Array.isArray(raw.staff_applied_roles)
              ? raw.staff_applied_roles
              : (typeof raw.staff_applied_roles === 'string'
                ? JSON.parse(raw.staff_applied_roles)
                : ['manager', 'hr_admin', 'hr_executive', 'recruiter', 'payroll_admin', 'auditor'])
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load shift settings:', err?.message || err);
      });
    return () => {
      active = false;
    };
  }, []);

  const today = getIndiaDateString();
  const hasEmployeeProfile = Boolean(currentUser?.employee_id);
  const myPunch = hasEmployeeProfile
    ? attendance.find(a => Number(a.employee_id) === Number(currentUser.employee_id) && a.date === today)
    : null;
  const hasPunchedIn = Boolean(myPunch?.punch_in);
  const isPunchComplete = Boolean(myPunch?.punch_in && myPunch?.punch_out);
  const currentEmployeeName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.name;

  const myMissingPunches = useMemo(() => {
    if (!currentUser?.employee_id) return [];
    return attendance.filter((a) => (
      Number(a.employee_id) === Number(currentUser.employee_id) &&
      a.date < today &&
      !a.punch_out &&
      !regularizationRequests.some((r) => Number(r.employee_id) === Number(currentUser.employee_id) && r.date === a.date && r.status === 'pending')
    ));
  }, [attendance, currentUser, today, regularizationRequests]);

  const handleOpenRegularizeForRecord = (record) => {
    setRegDate(record.date);
    setRegIn(record.punch_in || '09:15 AM');
    setRegOut(record.punch_out || '06:30 PM');
    setRegReason(record.punch_out ? `Correction for punch times on ${record.date}` : `Missed punch-out on ${record.date}. Requested standard exit time.`);
    setRegModalError('');
    setShowRegModal(true);
  };

  const handlePunchClick = async () => {
    if (!hasEmployeeProfile || isPunchComplete || isPunching) return;

    setIsPunching(true);
    setPunchFeedback({ text: 'Acquiring GPS location...', type: 'info' });

    let coords = null;
    try {
      coords = await getCurrentPositionAsync();
    } catch (geoErr) {
      console.warn('Geolocation warning:', geoErr.message);
    }

    try {
      const res = await punchAttendance(currentUser.employee_id, currentUser.branch_name || 'Web Portal', coords);
      if (res?.type === 'in') {
        const distStr = res.punch?.distance_meters != null ? ` (📍 ${Math.round(res.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched IN at ${res.punch?.punch_in || 'now'}${distStr}`, type: 'success' });
      } else if (res?.type === 'out') {
        const distStr = res.punch?.distance_meters != null ? ` (📍 ${Math.round(res.punch.distance_meters)}m)` : '';
        setPunchFeedback({ text: `Punched OUT at ${res.punch?.punch_out || 'now'}${distStr}`, type: 'success' });
      } else {
        setPunchFeedback({ text: 'Already completed attendance for today', type: 'info' });
      }
    } catch (err) {
      setPunchFeedback({ text: `Error saving punch: ${err?.data?.message || err.message}`, type: 'error' });
    } finally {
      setIsPunching(false);
      setTimeout(() => setPunchFeedback(null), 5000);
    }
  };

  const handleRegSubmit = async (e) => {
    e.preventDefault();
    if (!regDate || !regReason) return;
    setWorkflowError('');
    setRegModalError('');
    try {
      await submitRegularization({
        date: regDate,
        punch_in_requested: regIn,
        punch_out_requested: regOut,
        reason: regReason
      });
      setShowRegModal(false);
      setRegReason('');
    } catch (error) {
      const msg = error?.data?.message || error.message || 'Unable to save the regularization request.';
      setRegModalError(msg);
      setWorkflowError(msg);
    }
  };

  const handleReviewRegularization = async (requestId, decision) => {
    setWorkflowError('');
    try {
      await reviewRegularization(requestId, decision);
    } catch (error) {
      setWorkflowError(error?.data?.message || error.message || 'Unable to review the regularization request.');
    }
  };

  const handleSaveShiftSettings = async (e) => {
    e.preventDefault();
    setSavingShiftSettings(true);
    setShiftFeedback(null);
    try {
      const res = await api.updateAttendanceShiftSettings(shiftSettings);
      if (res?.data) {
        const raw = res.data;
        setShiftSettings({
          ...raw,
          staff_applied_roles: Array.isArray(raw.staff_applied_roles)
            ? raw.staff_applied_roles
            : (typeof raw.staff_applied_roles === 'string'
              ? JSON.parse(raw.staff_applied_roles)
              : ['manager', 'hr_admin', 'hr_executive', 'recruiter', 'payroll_admin', 'auditor'])
        });
      }
      setShiftFeedback({ text: 'All shift timings, grace allowances, and role assignments saved successfully.', type: 'success' });
    } catch (err) {
      setShiftFeedback({ text: err?.data?.message || err.message || 'Unable to update shift settings.', type: 'error' });
    } finally {
      setSavingShiftSettings(false);
      setTimeout(() => setShiftFeedback(null), 4000);
    }
  };

  const handleToggleStaffRole = (roleId) => {
    setShiftSettings((prev) => {
      const currentRoles = Array.isArray(prev.staff_applied_roles) ? prev.staff_applied_roles : [];
      const exists = currentRoles.includes(roleId);
      return {
        ...prev,
        staff_applied_roles: exists
          ? currentRoles.filter((r) => r !== roleId)
          : [...currentRoles, roleId],
      };
    });
  };

  const handleSelectAllStaffRoles = () => {
    setShiftSettings((prev) => ({
      ...prev,
      staff_applied_roles: staffRolesList.map((r) => r.id),
    }));
  };

  const handleClearAllStaffRoles = () => {
    setShiftSettings((prev) => ({
      ...prev,
      staff_applied_roles: [],
    }));
  };

  // Days in selected month
  const totalDaysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const daysArray = useMemo(() => {
    return Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
  }, [totalDaysInMonth]);

  // Compute Muster Roll data for active employees
  const musterRollData = useMemo(() => {
    const list = employees.filter((emp) => {
      if (emp.status === 'resigned' || emp.status === 'terminated') return false;
      if (isBranchScoped) {
        return (
          emp.branch_name === activeBranch ||
          (activeBranch.includes('Prayagraj') && emp.branch_name?.includes('Prayagraj')) ||
          (activeBranch.includes('Kaushambi') && emp.branch_name?.includes('Kaushambi'))
        );
      }
      return true;
    });

    const monthStr = String(selectedMonth).padStart(2, '0');
    const todayStr = getIndiaDateString();

    return list.map((emp) => {
      let presentCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let weekOffCount = 0;
      let lateCount = 0;

      const dailyRecords = {};

      for (let day = 1; day <= totalDaysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;
        const dayOfWeek = new Date(selectedYear, selectedMonth - 1, day).getDay(); // 0 is Sunday
        const isSunday = dayOfWeek === 0;

        const attRec = attendance.find(
          (a) => Number(a.employee_id) === Number(emp.id) && a.date === dateKey
        );

        const leaveRec = (leaveRequests || []).find(
          (l) => Number(l.employee_id) === Number(emp.id) &&
                 l.status === 'approved' &&
                 dateKey >= l.from_date &&
                 dateKey <= l.to_date
        );

        let cell = { status: '—', text: '—', color: 'text-slate-300', bg: 'bg-slate-50', hours: 0, isLate: false };
        const isExecutiveExempt = emp.role === 'super_admin' ||
          String(emp.designation || '').toLowerCase().includes('director') ||
          String(emp.designation || '').toLowerCase().includes('owner');

        if (attRec && attRec.punch_in) {
          const hours = parseFloat(attRec.work_hours || 0);
          const late = getLateArrivalInfo(attRec.punch_in, shiftSettings, emp.role);
          if (late.isLate) lateCount++;

          const dutyHours = getShiftDutyMinutes(shiftSettings, emp.role) / 60;
          const fullDayMin = shiftSettings?.full_day_min_hours !== null && shiftSettings?.full_day_min_hours !== undefined && shiftSettings?.full_day_min_hours !== ''
            ? Number(shiftSettings.full_day_min_hours)
            : Math.max(1, Number((dutyHours - 0.5).toFixed(2)));
          const halfDayMin = shiftSettings?.half_day_min_hours !== null && shiftSettings?.half_day_min_hours !== undefined && shiftSettings?.half_day_min_hours !== ''
            ? Number(shiftSettings.half_day_min_hours)
            : Number((dutyHours / 2).toFixed(2));

          if (hours > 0 && hours < halfDayMin) {
            absentCount++;
            cell = { status: 'A', text: 'A', color: 'text-rose-700', bg: 'bg-rose-100 font-bold', hours, isLate: late.isLate };
          } else if (hours > 0 && hours < fullDayMin) {
            halfDayCount++;
            cell = { status: 'HD', text: 'HD', color: 'text-amber-700', bg: 'bg-amber-100 font-bold', hours, isLate: late.isLate };
          } else {
            presentCount++;
            cell = { status: 'P', text: 'P', color: 'text-emerald-700', bg: 'bg-emerald-100 font-bold', hours, isLate: late.isLate };
          }
        } else if (leaveRec) {
          leaveCount++;
          cell = { status: 'L', text: 'L', color: 'text-purple-700', bg: 'bg-purple-100 font-bold', hours: 0, isLate: false };
        } else if (isSunday) {
          weekOffCount++;
          cell = { status: 'WO', text: 'WO', color: 'text-slate-400', bg: 'bg-slate-100', hours: 0, isLate: false };
        } else if (isExecutiveExempt) {
          cell = { status: 'EX', text: 'EX', color: 'text-teal-700', bg: 'bg-teal-50 font-bold', hours: 0, isLate: false };
        } else if (dateKey <= todayStr) {
          absentCount++;
          cell = { status: 'A', text: 'A', color: 'text-rose-700', bg: 'bg-rose-100 font-bold', hours: 0, isLate: false };
        } else {
          cell = { status: '—', text: '—', color: 'text-slate-300', bg: 'bg-white', hours: 0, isLate: false };
        }

        dailyRecords[day] = cell;
      }

      const lateThreshold = parseInt(shiftSettings?.late_mark_threshold || 3, 10);
      const penaltyCount = (shiftSettings?.auto_half_day_deduction && lateCount >= lateThreshold)
        ? Math.floor(lateCount / lateThreshold) * 0.5
        : 0;

      const isExecutiveExempt = emp.role === 'super_admin' ||
        String(emp.designation || '').toLowerCase().includes('director') ||
        String(emp.designation || '').toLowerCase().includes('owner');

      const payableDays = isExecutiveExempt
        ? totalDaysInMonth
        : Math.max(0, presentCount + (halfDayCount * 0.5) + leaveCount + weekOffCount - penaltyCount);

      return {
        employee: emp,
        dailyRecords,
        presentCount,
        leaveCount,
        halfDayCount,
        absentCount,
        weekOffCount,
        lateCount,
        penaltyCount,
        payableDays,
      };
    });
  }, [employees, attendance, leaveRequests, isBranchScoped, activeBranch, selectedYear, selectedMonth, totalDaysInMonth, shiftSettings]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filtered muster roll rows based on selected employee
  const displayedMusterRollData = useMemo(() => {
    if (selectedEmployeeId === 'all') return musterRollData;
    return musterRollData.filter((r) => String(r.employee.id) === String(selectedEmployeeId));
  }, [musterRollData, selectedEmployeeId]);

  const selectedEmployeeObj = useMemo(() => {
    if (selectedEmployeeId === 'all') return null;
    return musterRollData.find((r) => String(r.employee.id) === String(selectedEmployeeId))?.employee || null;
  }, [musterRollData, selectedEmployeeId]);

  // Keep selectedEmployeeId valid if branch changes
  useEffect(() => {
    if (selectedEmployeeId !== 'all') {
      const exists = musterRollData.some((r) => String(r.employee.id) === String(selectedEmployeeId));
      if (!exists && currentUser?.role !== 'employee') {
        setSelectedEmployeeId('all');
      }
    }
  }, [musterRollData, selectedEmployeeId, currentUser?.role]);

  // Late Comers Summary for Shift Automation
  const lateComersSummary = useMemo(() => {
    const monthStr = String(selectedMonth).padStart(2, '0');
    const lateList = [];

    musterRollData.forEach((row) => {
      if (row.lateCount > 0) {
        const lateDays = [];
        for (let d = 1; d <= totalDaysInMonth; d++) {
          if (row.dailyRecords[d]?.isLate) {
            const dateKey = `${selectedYear}-${monthStr}-${String(d).padStart(2, '0')}`;
            const punch = attendance.find(a => Number(a.employee_id) === Number(row.employee.id) && a.date === dateKey);
            lateDays.push({
              date: dateKey,
              day: d,
              punchIn: punch?.punch_in,
              lateInfo: getLateArrivalInfo(punch?.punch_in, shiftSettings, row.employee?.role)
            });
          }
        }
        lateList.push({
          employee: row.employee,
          lateCount: row.lateCount,
          penaltyTriggered: row.penaltyCount > 0,
          penaltyDays: row.penaltyCount,
          lateDays,
        });
      }
    });

    return lateList.sort((a, b) => b.lateCount - a.lateCount);
  }, [musterRollData, selectedMonth, selectedYear, totalDaysInMonth, attendance, shiftSettings]);

  // 1-Click Muster Roll & Employee Report CSV Export
  const handleExportMusterRoll = () => {
    const monthName = monthNames[selectedMonth - 1] || `Month-${selectedMonth}`;
    const isSingleEmployee = selectedEmployeeId !== 'all';
    const targetRows = isSingleEmployee ? displayedMusterRollData : musterRollData;
    const singleEmp = isSingleEmployee ? targetRows[0]?.employee : null;

    const headers = [
      'Employee Code',
      'Employee Name',
      'Designation',
      'Branch',
      ...daysArray.map((d) => `Day ${d}`),
      'Present Days',
      'Leaves',
      'Half Days',
      'Absent Days',
      'Week Offs',
      'Late Marks',
      'Late Penalty Days',
      'Total Payable Days',
    ];

    const rows = targetRows.map((row) => [
      `"${row.employee.employee_code || ''}"`,
      `"${row.employee.first_name || ''} ${row.employee.last_name || ''}"`,
      `"${row.employee.designation || ''}"`,
      `"${row.employee.branch_name || ''}"`,
      ...daysArray.map((d) => `"${row.dailyRecords[d]?.status || '—'}"`),
      row.presentCount,
      row.leaveCount,
      row.halfDayCount,
      row.absentCount,
      row.weekOffCount,
      row.lateCount,
      row.penaltyCount,
      row.payableDays,
    ]);

    let csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    // If single employee report, append a detailed day-by-day attendance log breakdown
    if (isSingleEmployee && targetRows.length > 0) {
      const row = targetRows[0];
      const monthStr = String(selectedMonth).padStart(2, '0');
      const dailyHeaders = ['Day', 'Date', 'Day of Week', 'Status', 'Punch In', 'Work Hours', 'Arrival Status'];
      const dailyData = daysArray.map((d) => {
        const dayStr = String(d).padStart(2, '0');
        const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;
        const dayOfWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(selectedYear, selectedMonth - 1, d).getDay()];
        const cell = row.dailyRecords[d];
        const attRec = attendance.find((a) => Number(a.employee_id) === Number(row.employee.id) && a.date === dateKey);
        const statusMap = {
          P: 'Present',
          HD: 'Half Day (<4.5 hrs)',
          L: 'Approved Leave',
          WO: 'Week Off (Sunday)',
          A: 'Absent',
          '—': 'Future / Unrecorded'
        };
        const statusLabel = statusMap[cell.status] || cell.status;
        const arrivalStatus = cell.isLate ? 'Late Arrival' : (attRec?.punch_in ? 'On Time' : '—');

        return [
          d,
          dateKey,
          dayOfWeekName,
          `"${statusLabel}"`,
          `"${attRec?.punch_in || '—'}"`,
          `"${cell.hours ? cell.hours + ' hrs' : '0.00 hrs'}"`,
          `"${arrivalStatus}"`
        ].join(',');
      });

      csvContent += '\n\nDetailed Day-by-Day Attendance Breakdown\n' + dailyHeaders.join(',') + '\n' + dailyData.join('\n');
    }

    const filename = isSingleEmployee && singleEmp
      ? `Pinweb_Attendance_Report_${singleEmp.employee_code || singleEmp.id}_${singleEmp.first_name}_${singleEmp.last_name}_${monthName}_${selectedYear}.csv`.replace(/\s+/g, '_')
      : `Pinweb_Muster_Roll_${monthName}_${selectedYear}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 uppercase tracking-wide">
              Time & Attendance
            </span>
            <span className="text-xs text-slate-500 font-medium">Web Punches, Biometrics & Regularization</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {currentUser?.role === 'employee' ? 'My Attendance & Punches' : 'Attendance & Time Tracking'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            One punch-in/out session is supported per employee per India date. Use regularization to correct a missed or incorrect punch; additional sessions are not supported.
          </p>
        </div>

        {currentUser.role !== 'super_admin' && (
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              disabled={!hasEmployeeProfile}
              title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
              onClick={() => {
                setRegModalError('');
                setShowRegModal(true);
              }}
            >
              Request Regularization
            </Button>

            <Button
              variant={isPunchComplete ? "secondary" : hasPunchedIn ? "danger" : "primary"}
              icon={Clock}
              disabled={!hasEmployeeProfile || isPunchComplete || isPunching}
              title={!hasEmployeeProfile ? 'Account is not linked to an employee record' : undefined}
              onClick={handlePunchClick}
            >
              {isPunching ? "Locating GPS..." : isPunchComplete ? "Punch Completed" : hasPunchedIn ? "Punch Out" : "Punch In"}
            </Button>
          </div>
        )}
        {currentUser.role === 'super_admin' && (
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="md">👑 Executive Attendance Supervisor</Badge>
          </div>
        )}
      </div>

      {punchFeedback && (
        <div className={`border text-xs px-4 py-2.5 rounded-xl font-medium flex items-center justify-between animate-fadeIn ${
          punchFeedback.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : punchFeedback.type === 'info'
            ? 'bg-slate-100 border-slate-200 text-slate-700'
            : 'bg-teal-50 border-teal-200 text-teal-700'
        }`}>
          <div className="flex items-center gap-2">
            {punchFeedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            )}
            <span>{punchFeedback.text}</span>
          </div>
          <span className={`text-[10px] font-mono ${punchFeedback.type === 'error' ? 'text-rose-400' : 'text-teal-600'}`}>
            {punchFeedback.type === 'error' ? 'Geofence Validation' : 'Saved in MySQL Database'}
          </span>
        </div>
      )}
      {workflowError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {workflowError}
        </div>
      )}

      {/* Employee Missing Punch Alert (Only for regular employees, NOT Super Admin) */}
      {currentUser.role !== 'super_admin' && myMissingPunches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-950">
                You have {myMissingPunches.length} missed punch-out session(s) awaiting regularization.
              </p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Dates: {myMissingPunches.map(p => p.date).join(', ')}. Submit a regularization request to clear work hours for payroll.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenRegularizeForRecord(myMissingPunches[0])}
            className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100/50 shrink-0"
          >
            Regularize Now
          </Button>
        </div>
      )}

      {/* Super Admin / Approver Review Notification Banner */}
      {currentUser.role === 'super_admin' && regularizationRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <p className="font-bold text-teal-950">
                {regularizationRequests.filter(r => r.status === 'pending').length} Employee Regularization Request(s) awaiting your decision.
              </p>
              <p className="text-teal-700 text-[11px] mt-0.5">
                Staff members have requested punch corrections. Review them to finalize work hours for payroll.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setActiveTab('regularization')}
            className="shrink-0"
          >
            Review Requests ({regularizationRequests.filter(r => r.status === 'pending').length})
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('punches')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'punches' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Daily Punch Ledger ({filteredAttendance.length})
        </button>

        <button
          onClick={() => setActiveTab('regularization')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'regularization' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" /> Regularization Requests ({filteredRegularization.length})
        </button>

        <button
          onClick={() => setActiveTab('muster_roll')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'muster_roll' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Monthly Muster Roll & Reports
        </button>

        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-3 font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'shifts' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" /> Shift & Grace Automation
        </button>

        {isBranchScoped && (
          <div className="ml-auto pb-2 flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Branch: {activeBranch}</span>
          </div>
        )}
      </div>

      {/* TAB 1: PUNCHES */}
      {activeTab === 'punches' && (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Punch In</th>
                  <th className="px-4 py-3">Punch Out</th>
                  <th className="px-4 py-3">Work Hours</th>
                  <th className="px-4 py-3">IP & Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} role="status" className="px-5 py-8 text-center text-slate-500">
                      {isBranchScoped
                        ? `No attendance records found for ${activeBranch}.`
                        : 'No attendance records are available for your team.'}
                    </td>
                  </tr>
                ) : filteredAttendance.map(att => {
                  const employeeId = Number(att.employee_id);
                  const emp = employees.find(e => Number(e.id) === employeeId);
                  const isCurrentEmployee = employeeId === Number(currentUser.employee_id);
                  const employeeName = emp
                    ? `${emp.first_name} ${emp.last_name}`
                    : isCurrentEmployee
                      ? currentEmployeeName
                      : [att.first_name, att.last_name].filter(Boolean).join(' ') || (att.employee_code ? `${att.employee_code}` : `EMP-${att.employee_id}`);
                  const employeeInfo = emp?.designation || (isCurrentEmployee ? currentUser.employee_code : '');

                  const isPastDate = att.date < today;
                  const isMissingPunchOut = isPastDate && !att.punch_out;
                  const regReq = regularizationRequests.find((r) => (
                    Number(r.employee_id) === employeeId && r.date === att.date
                  ));

                  return (
                    <tr key={att.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{employeeName}</div>
                        {employeeInfo && <div className="text-[11px] text-slate-400">{employeeInfo}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{att.date}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const empRole = emp?.role || att.role || 'employee';
                          const lateInfo = getLateArrivalInfo(att.punch_in, shiftSettings, empRole);
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-semibold ${lateInfo.isLate ? 'text-amber-800 font-bold' : 'text-emerald-600'}`}>
                                {att.punch_in}
                              </span>
                              {lateInfo.isLate && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200"
                                  title={`Late by ${lateInfo.minutesLate} minutes (Shift: ${lateInfo.shiftName} · Allowed up to ${lateInfo.cutoffTimeStr})`}
                                >
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  Late (+{lateInfo.minutesLate}m)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {att.punch_out ? (
                          <span className="font-semibold text-slate-700">{att.punch_out}</span>
                        ) : isMissingPunchOut ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Missing Punch Out
                            </span>
                            {regReq && (
                              <span className="text-[10px] text-teal-600 font-medium">
                                Reg {regReq.status} ({regReq.punch_out_requested})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-teal-600">— (Working)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {att.punch_out ? (
                          (() => {
                            const workedMins = getWorkedMinutes(att.work_hours, att.punch_in, att.punch_out);
                            const dutyMins = getShiftDutyMinutes(shiftSettings, emp?.role);
                            const extraMins = workedMins - dutyMins;
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-slate-800">
                                  {formatWorkDuration(att.work_hours, att.punch_in, att.punch_out)}
                                </span>
                                {extraMins >= 15 && (
                                  <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    +{Math.floor(extraMins / 60)}h {String(extraMins % 60).padStart(2, '0')}m Extra
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : isMissingPunchOut ? (
                          <span className="text-slate-400">0h 00m</span>
                        ) : (
                          <span className="text-teal-600">In Progress</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{att.location}</span>
                          {att.geofence_status === 'within_geofence' && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200"
                              title={`GPS Verified · Distance: ${att.distance_meters != null ? Math.round(att.distance_meters) + 'm' : 'Within boundary'}`}
                            >
                              <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                              GPS Verified{att.distance_meters != null ? ` · ${Math.round(att.distance_meters)}m` : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">{att.ip_address}</span>
                          {att.latitude && att.longitude && (
                            <span className="text-[10px] text-slate-400 font-mono" title={`GPS: ${att.latitude}, ${att.longitude}`}>
                              ({Number(att.latitude).toFixed(4)}, {Number(att.longitude).toFixed(4)})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isMissingPunchOut && att.status === 'Present' ? (
                          <Badge variant="warning" size="sm">
                            Incomplete
                          </Badge>
                        ) : (
                          <Badge variant={att.status === 'Present' ? 'success' : 'warning'} size="sm">
                            {att.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {regReq?.status === 'pending' ? (
                          canApprove && !isCurrentEmployee ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('regularization')}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                            >
                              <Clock className="w-3 h-3 text-blue-600" /> Review
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3" /> Reg Pending
                            </span>
                          )
                        ) : isMissingPunchOut && isCurrentEmployee ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRegularizeForRecord(att)}
                            className="inline-flex items-center gap-1 rounded bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 border border-teal-200 transition"
                          >
                            <Clock className="w-3 h-3 text-teal-600" /> Regularize
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: REGULARIZATION */}
      {activeTab === 'regularization' && (
        <Card
          title="Attendance Regularization Requests"
          subtitle={`Workflow for missed punches, client visits, and network issues${isBranchScoped ? ` · Filtered: ${activeBranch}` : ''}`}
        >
          <div className="space-y-3">
            {filteredRegularization.length === 0 ? (
              <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                {isBranchScoped
                  ? `No attendance regularization requests found for ${activeBranch}.`
                  : 'No attendance regularization requests have been submitted.'}
              </p>
            ) : filteredRegularization.map(req => (
              <div key={req.id} className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{req.employee_name}</h4>
                    <span className="text-slate-400 font-medium">for Date: {req.date}</span>
                    <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} size="sm">
                      {req.status}
                    </Badge>
                  </div>
                  <p className="text-slate-700 mt-1 italic">"{req.reason}"</p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Requested In: <strong>{req.punch_in_requested}</strong> | Requested Out: <strong>{req.punch_out_requested}</strong>
                  </p>
                </div>

                {canApprove && req.status === 'pending' && Number(req.employee_id) !== Number(currentUser?.employee_id) && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="danger" onClick={() => handleReviewRegularization(req.id, 'rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" variant="success" onClick={() => handleReviewRegularization(req.id, 'approved')}>
                      Approve Regularization
                    </Button>
                  </div>
                )}
                {req.status === 'pending' && Number(req.employee_id) === Number(currentUser?.employee_id) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                    Your request · Awaiting approval
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 3: MONTHLY MUSTER ROLL & REPORTS */}
      {activeTab === 'muster_roll' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Employee Filter */}
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700 shrink-0">Staff Member:</span>
                <select
                  value={selectedEmployeeId}
                  disabled={currentUser.role === 'employee'}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[210px] truncate"
                >
                  {currentUser.role !== 'employee' && (
                    <option value="all">👥 All Employees ({musterRollData.length})</option>
                  )}
                  {musterRollData.map((row) => (
                    <option key={row.employee.id} value={String(row.employee.id)}>
                      {row.employee.first_name} {row.employee.last_name} ({row.employee.employee_code || `EMP-${row.employee.id}`})
                    </option>
                  ))}
                </select>
                {selectedEmployeeId !== 'all' && currentUser.role !== 'employee' && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId('all')}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 underline ml-1 shrink-0"
                  >
                    View All
                  </button>
                )}
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              {/* Month Picker */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700 shrink-0">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
              </div>

              {/* Year Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 shrink-0">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <span className="text-xs text-slate-400 hidden xl:inline">
                ({totalDaysInMonth} Days · {isBranchScoped ? activeBranch : 'All Branches'})
              </span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleExportMusterRoll}
              className="shadow-sm shrink-0"
            >
              {selectedEmployeeId === 'all'
                ? '📥 Download Muster Roll (Excel/CSV)'
                : `📥 Download ${selectedEmployeeObj?.first_name || 'Staff'} Report (Excel/CSV)`}
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {selectedEmployeeId === 'all' ? 'Active Staff Tracked' : 'Staff Member'}
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block truncate">
                {selectedEmployeeId === 'all'
                  ? `${displayedMusterRollData.length} Employees`
                  : `${selectedEmployeeObj ? `${selectedEmployeeObj.first_name} ${selectedEmployeeObj.last_name}` : '1 Employee'}`}
              </span>
              {selectedEmployeeId !== 'all' && selectedEmployeeObj && (
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block truncate">
                  {selectedEmployeeObj.employee_code} · {selectedEmployeeObj.designation || 'Staff'}
                </span>
              )}
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {selectedEmployeeId === 'all' ? 'Total Working Days' : 'Present & Half Days'}
              </span>
              <span className="text-xl font-bold text-teal-700 mt-1 block">
                {selectedEmployeeId === 'all'
                  ? `${totalDaysInMonth - daysArray.filter(d => new Date(selectedYear, selectedMonth - 1, d).getDay() === 0).length} Days`
                  : `${displayedMusterRollData[0]?.presentCount || 0} P · ${displayedMusterRollData[0]?.halfDayCount || 0} HD`}
              </span>
              {selectedEmployeeId !== 'all' && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Leaves: {displayedMusterRollData[0]?.leaveCount || 0} · Absent: {displayedMusterRollData[0]?.absentCount || 0}
                </span>
              )}
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Late Marks</span>
              <span className="text-xl font-bold text-amber-600 mt-1 block">
                {displayedMusterRollData.reduce((acc, row) => acc + row.lateCount, 0)} Recorded
              </span>
              {selectedEmployeeId !== 'all' && (
                <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">
                  {displayedMusterRollData[0]?.penaltyCount > 0
                    ? `Penalty applied: -${displayedMusterRollData[0]?.penaltyCount} day`
                    : 'Within grace policy'}
                </span>
              )}
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {selectedEmployeeId === 'all' ? 'Penalties Triggered' : 'Total Payable Days'}
              </span>
              <span className="text-xl font-bold text-rose-600 mt-1 block">
                {selectedEmployeeId === 'all'
                  ? `${displayedMusterRollData.filter(r => r.penaltyCount > 0).length} Staff (3+ Late)`
                  : `${displayedMusterRollData[0]?.payableDays != null ? displayedMusterRollData[0].payableDays.toFixed(1) : '0.0'} Days`}
              </span>
              {selectedEmployeeId !== 'all' && (
                <span className="text-[10px] text-teal-700 mt-0.5 block font-semibold">
                  Net Salary Payable for Month
                </span>
              )}
            </div>
          </div>

          {/* Muster Roll Matrix Card */}
          <Card
            title={selectedEmployeeId === 'all'
              ? `Muster Roll Ledger — ${monthNames[selectedMonth - 1] || selectedMonth} ${selectedYear}`
              : `Employee Attendance Matrix — ${selectedEmployeeObj?.first_name} ${selectedEmployeeObj?.last_name} (${monthNames[selectedMonth - 1] || selectedMonth} ${selectedYear})`}
            subtitle={selectedEmployeeId === 'all'
              ? "P = Present · HD = Half Day (<4.5 hrs) · L = Approved Leave · WO = Week Off (Sunday) · EX = Executive Exempt · A = Absent"
              : `${selectedEmployeeObj?.employee_code || ''} · ${selectedEmployeeObj?.designation || ''} · ${selectedEmployeeObj?.branch_name || ''} · 1 to ${totalDaysInMonth} Day Attendance Grid`}
            bodyClassName="p-0 overflow-hidden"
          >
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 min-w-44 border-r border-slate-200 shadow-sm text-left">
                      Staff Member
                    </th>
                    {daysArray.map((d) => {
                      const dayOfWeek = new Date(selectedYear, selectedMonth - 1, d).getDay();
                      const isSun = dayOfWeek === 0;
                      return (
                        <th
                          key={d}
                          className={`px-1.5 py-2 text-center min-w-7 border-r border-slate-200/60 ${isSun ? 'bg-amber-50/70 text-amber-800' : ''}`}
                        >
                          <div>{d}</div>
                          <div className="text-[8px] font-normal text-slate-400">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayOfWeek]}
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 bg-emerald-50 text-emerald-800 text-center font-bold min-w-10">P</th>
                    <th className="px-2 py-2 bg-purple-50 text-purple-800 text-center font-bold min-w-10">L</th>
                    <th className="px-2 py-2 bg-amber-50 text-amber-800 text-center font-bold min-w-10">HD</th>
                    <th className="px-2 py-2 bg-rose-50 text-rose-800 text-center font-bold min-w-10">A</th>
                    <th className="px-2 py-2 bg-amber-100/60 text-amber-900 text-center font-bold min-w-12">Late</th>
                    <th className="px-3 py-2 bg-slate-900 text-white text-center font-bold min-w-14">Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {displayedMusterRollData.length === 0 ? (
                    <tr>
                      <td colSpan={daysArray.length + 7} className="px-5 py-8 text-center text-slate-500">
                        {selectedEmployeeId === 'all'
                          ? 'No employees found for this muster period.'
                          : 'Selected employee has no attendance record in this period.'}
                      </td>
                    </tr>
                  ) : (
                    displayedMusterRollData.map((row) => (
                      <tr key={row.employee.id} className="hover:bg-slate-50/70 transition">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-slate-200 shadow-sm text-left">
                          <div className="font-bold text-slate-900 leading-tight">
                            {row.employee.first_name} {row.employee.last_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {row.employee.employee_code} · {row.employee.branch_name || 'Office'}
                          </div>
                        </td>
                        {daysArray.map((d) => {
                          const cell = row.dailyRecords[d];
                          return (
                            <td
                              key={d}
                              className={`p-1 text-center border-r border-slate-100 text-[10px] ${cell.bg}`}
                              title={`Day ${d}: ${cell.status === 'P' ? 'Present' : cell.status === 'L' ? 'Leave' : cell.status === 'HD' ? 'Half Day' : cell.status === 'WO' ? 'Week Off' : cell.status === 'A' ? 'Absent' : 'Future'}${cell.hours ? ` (${formatWorkDuration(cell.hours)})` : ''}${cell.isLate ? ' · Late' : ''}`}
                            >
                              <span className={cell.color}>{cell.text}</span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center font-bold text-emerald-700 bg-emerald-50/40">{row.presentCount}</td>
                        <td className="px-2 py-2 text-center font-bold text-purple-700 bg-purple-50/40">{row.leaveCount}</td>
                        <td className="px-2 py-2 text-center font-bold text-amber-700 bg-amber-50/40">{row.halfDayCount}</td>
                        <td className="px-2 py-2 text-center font-bold text-rose-700 bg-rose-50/40">{row.absentCount}</td>
                        <td className="px-2 py-2 text-center font-bold text-amber-800 bg-amber-50/40">
                          {row.lateCount > 0 ? (
                            <span className={row.penaltyCount > 0 ? 'text-rose-600 underline font-black' : ''}>
                              {row.lateCount}
                            </span>
                          ) : '0'}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-slate-900 bg-slate-100">
                          {row.payableDays.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-400" /> P: Present</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-200 border border-purple-400" /> L: Approved Leave</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-400" /> HD: Half Day (&lt;4.5h)</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" /> WO: Week Off</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-100 border border-teal-400" /> EX: Exempt</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-200 border border-rose-400" /> A: Absent</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                Formula: Payable Days = Present + (HD × 0.5) + Leaves + WeekOffs − Late Penalties
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: SHIFT & GRACE AUTOMATION */}
      {activeTab === 'shifts' && (
        <div className="space-y-6">
          {/* Shift Timing and Policy Configuration */}
          <Card
            title={
              isSuperAdmin
                ? "Office Shift Timing & Grace Period Rules"
                : isEmployee
                ? "My Office Shift & Attendance Policy"
                : "Executive & Staff Shift Policy"
            }
            subtitle={
              isSuperAdmin
                ? "Configure standard work timings, grace period tolerance, and automated late-mark penalties"
                : isEmployee
                ? "Official work timings, grace period allowance, and late-mark rules"
                : "Official work timings and grace period allowance configured for management & staff"
            }
          >
            {shiftFeedback && (
              <div className={`p-3 rounded-lg text-xs font-semibold mb-4 border flex items-center gap-2 ${
                shiftFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                {shiftFeedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                <span>{shiftFeedback.text}</span>
              </div>
            )}

            {/* 1. SUPER ADMIN: FULL CONFIGURATION & SAVE FORM */}
            {isSuperAdmin && (
              <form onSubmit={handleSaveShiftSettings} className="space-y-6 text-xs">
                {/* SECTION 1: STANDARD EMPLOYEE SHIFT */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-teal-100 text-teal-800">
                        <Clock className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">1. Standard Employee Shift (Baseline)</h3>
                        <p className="text-[11px] text-slate-500">Applies automatically to all Regular Employees</p>
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">Regular Employees</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Shift Name:</label>
                      <input
                        type="text"
                        value={shiftSettings.shift_name || 'General Employee Shift'}
                        onChange={(e) => setShiftSettings((p) => ({ ...p, shift_name: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Standard Shift Start Time:</label>
                      <input
                        type="text"
                        value={shiftSettings.start_time || '09:30 AM'}
                        placeholder="e.g. 09:30 AM"
                        onChange={(e) => setShiftSettings((p) => ({ ...p, start_time: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM</span>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Standard Shift End Time:</label>
                      <input
                        type="text"
                        value={shiftSettings.end_time || '06:30 PM'}
                        placeholder="e.g. 06:30 PM"
                        onChange={(e) => setShiftSettings((p) => ({ ...p, end_time: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Working Window</span>
                    </div>
                  </div>

                  {/* Live Auto-Calculated Duty Hours & Attendance Slabs */}
                  {(() => {
                    const dutyMins = getShiftDutyMinutes(shiftSettings, null);
                    const dutyHrs = Number((dutyMins / 60).toFixed(2));
                    const autoFull = Math.max(1, Number((dutyHrs - 0.5).toFixed(2)));
                    const autoHalf = Number((dutyHrs / 2).toFixed(2));
                    const activeFull = shiftSettings.full_day_min_hours !== null && shiftSettings.full_day_min_hours !== undefined && shiftSettings.full_day_min_hours !== ''
                      ? shiftSettings.full_day_min_hours
                      : '';
                    const activeHalf = shiftSettings.half_day_min_hours !== null && shiftSettings.half_day_min_hours !== undefined && shiftSettings.half_day_min_hours !== ''
                      ? shiftSettings.half_day_min_hours
                      : '';

                    return (
                      <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-teal-950">
                            Auto-Calculated Duty Duration: <span className="text-teal-700">{Math.floor(dutyMins / 60)}h {String(dutyMins % 60).padStart(2, '0')}m</span>
                          </span>
                          <span className="text-[11px] text-teal-800 font-medium">
                            Present: ≥ {activeFull !== '' ? activeFull : autoFull}h · Half Day: {activeHalf !== '' ? activeHalf : autoHalf}h – {activeFull !== '' ? activeFull : autoFull}h · Extra Badge: &gt; {dutyHrs}h
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Full Day Min Hours (Auto: {autoFull}h):
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="1"
                              max="24"
                              placeholder={`Auto (${autoFull})`}
                              value={activeFull}
                              onChange={(e) => setShiftSettings((p) => ({ ...p, full_day_min_hours: e.target.value }))}
                              className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Half Day Min Hours (Auto: {autoHalf}h):
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0.5"
                              max="24"
                              placeholder={`Auto (${autoHalf})`}
                              value={activeHalf}
                              onChange={(e) => setShiftSettings((p) => ({ ...p, half_day_min_hours: e.target.value }))}
                              className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200/70">
                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Employee Grace Period Allowance</span>
                      </div>
                      <label className="block font-medium text-slate-700 mb-1">Grace Period (Minutes):</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={shiftSettings.grace_period_minutes}
                          onChange={(e) => setShiftSettings((p) => ({ ...p, grace_period_minutes: Number(e.target.value) }))}
                          className="w-20 rounded-lg border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                        />
                        <span className="text-xs text-amber-900 font-semibold">
                          Punches up to {(() => {
                            const startMins = parseTimeToMinutes(shiftSettings.start_time || '09:30 AM') || 570;
                            const cutoff = startMins + Number(shiftSettings.grace_period_minutes || 15);
                            const h = Math.floor(cutoff / 60);
                            const m = cutoff % 60;
                            return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                          })()} will NOT be marked late.
                        </span>
                      </div>
                    </div>

                    <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200/80">
                      <div className="flex items-center gap-1.5 font-bold text-teal-900 mb-1">
                        <ShieldAlert className="w-4 h-4 text-teal-600" />
                        <span>Late-Mark Deduction Policy</span>
                      </div>
                      <label className="block font-medium text-slate-700 mb-1">Threshold for Half-Day (0.5) Penalty:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={shiftSettings.late_mark_threshold}
                          onChange={(e) => setShiftSettings((p) => ({ ...p, late_mark_threshold: Number(e.target.value) }))}
                          className="w-20 rounded-lg border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                        />
                        <span className="text-xs text-teal-900 font-medium">Late arrivals per month = 0.5 Day Leave Deduction</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: EXECUTIVE & STAFF ROLES SHIFT */}
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-indigo-100 text-indigo-800">
                        <Sliders className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">2. Executive & Staff Shift (Special Timings for Selected Roles)</h3>
                        <p className="text-[11px] text-slate-500">
                          Configure different work timings and grace periods for HR, Managers, Recruiters, and Auditors
                        </p>
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-xs text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(shiftSettings.staff_shift_enabled)}
                        onChange={(e) => setShiftSettings((p) => ({ ...p, staff_shift_enabled: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Enable Staff Shift</span>
                    </label>
                  </div>

                  {shiftSettings.staff_shift_enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Staff Shift Name:</label>
                          <input
                            type="text"
                            value={shiftSettings.staff_shift_name || 'Management & Staff Shift'}
                            onChange={(e) => setShiftSettings((p) => ({ ...p, staff_shift_name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Staff Shift Start Time:</label>
                          <input
                            type="text"
                            value={shiftSettings.staff_start_time || '10:00 AM'}
                            placeholder="e.g. 10:00 AM"
                            onChange={(e) => setShiftSettings((p) => ({ ...p, staff_start_time: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM</span>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Staff Shift End Time:</label>
                          <input
                            type="text"
                            value={shiftSettings.staff_end_time || '07:00 PM'}
                            placeholder="e.g. 07:00 PM"
                            onChange={(e) => setShiftSettings((p) => ({ ...p, staff_end_time: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 p-2 font-medium text-slate-800 bg-white"
                          />
                          <span className="text-[10px] text-slate-400 mt-0.5 block">Working Window</span>
                        </div>
                      </div>

                      <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Staff Grace Period Allowance</span>
                        </div>
                        <label className="block font-medium text-slate-700 mb-1">Grace Period (Minutes):</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={shiftSettings.staff_grace_period_minutes}
                            onChange={(e) => setShiftSettings((p) => ({ ...p, staff_grace_period_minutes: Number(e.target.value) }))}
                            className="w-20 rounded-lg border border-slate-300 p-2 font-bold text-slate-800 bg-white"
                          />
                          <span className="text-xs text-amber-900 font-semibold">
                            Punches up to {(() => {
                              const startMins = parseTimeToMinutes(shiftSettings.staff_start_time || '10:00 AM') || 600;
                              const cutoff = startMins + Number(shiftSettings.staff_grace_period_minutes || 15);
                              const h = Math.floor(cutoff / 60);
                              const m = cutoff % 60;
                              return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                            })()} will NOT be marked late for selected staff roles.
                          </span>
                        </div>
                      </div>

                      {/* ROLE SELECTION CHECKBOXES */}
                      <div className="bg-white p-4 rounded-xl border border-indigo-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100">
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <UserCheck className="w-4 h-4 text-indigo-600" />
                              <span>Select Roles to Apply This Shift (Employee ko chhod kar baki sabhi):</span>
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Checked roles will follow this shift. Unchecked roles will automatically use the Standard 09:30 AM Shift.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleSelectAllStaffRoles}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline"
                            >
                              Select All
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={handleClearAllStaffRoles}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {staffRolesList.map((role) => {
                            const isChecked = Array.isArray(shiftSettings.staff_applied_roles) && shiftSettings.staff_applied_roles.includes(role.id);
                            return (
                              <label
                                key={role.id}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition cursor-pointer select-none ${
                                  isChecked
                                    ? 'bg-indigo-50/60 border-indigo-300 shadow-sm'
                                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleStaffRole(role.id)}
                                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <div>
                                  <span className={`font-bold block text-xs ${isChecked ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {role.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                                    {role.desc}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <div className="mt-3 text-[11px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>
                            Currently {Array.isArray(shiftSettings.staff_applied_roles) ? shiftSettings.staff_applied_roles.length : 0} out of {staffRolesList.length} staff roles are configured with this custom timing.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* AUTOMATION TOGGLE & SAVE BUTTON */}
                <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 select-none">
                    <input
                      type="checkbox"
                      checked={shiftSettings.auto_half_day_deduction}
                      onChange={(e) => setShiftSettings((p) => ({ ...p, auto_half_day_deduction: e.target.checked }))}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span>Automate 0.5 Day Leave deduction in Muster Roll & Payroll when late threshold is crossed</span>
                  </label>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingShiftSettings}
                  >
                    {savingShiftSettings ? 'Saving Settings...' : 'Save Shift Timing Rules'}
                  </Button>
                </div>
              </form>
            )}

            {/* 2. REGULAR EMPLOYEE: READ-ONLY STANDARD SHIFT ONLY (STAFF SHIFT IS HIDDEN) */}
            {isEmployee && (
              <div className="space-y-6 text-xs">
                <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
                        <Clock className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {shiftSettings.shift_name || 'General Employee Shift'}
                        </h3>
                        <p className="text-[11px] text-slate-500">Official work timings assigned to regular employees</p>
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">Regular Employee Shift (Read-Only)</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Shift Schedule</div>
                      <div className="text-base font-bold text-slate-800 mt-1">
                        {shiftSettings.start_time || '09:30 AM'} — {shiftSettings.end_time || '06:30 PM'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">9.0 Hours Daily Window</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Grace Period</div>
                      <div className="text-base font-bold text-teal-700 mt-1">
                        {shiftSettings.grace_period_minutes || 15} Minutes
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Tolerance buffer</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">On-Time Cutoff</div>
                      <div className="text-base font-bold text-emerald-700 mt-1">
                        {(() => {
                          const startMins = parseTimeToMinutes(shiftSettings.start_time || '09:30 AM') || 570;
                          const cutoff = startMins + Number(shiftSettings.grace_period_minutes || 15);
                          const h = Math.floor(cutoff / 60);
                          const m = cutoff % 60;
                          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Punches by this time are not marked late</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/70">
                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Employee Grace Period Allowance</span>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Punches up to <strong className="font-bold underline">{(() => {
                          const startMins = parseTimeToMinutes(shiftSettings.start_time || '09:30 AM') || 570;
                          const cutoff = startMins + Number(shiftSettings.grace_period_minutes || 15);
                          const h = Math.floor(cutoff / 60);
                          const m = cutoff % 60;
                          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()}</strong> will <strong className="text-emerald-700">NOT</strong> be marked late.
                      </p>
                    </div>

                    <div className="bg-teal-50/80 p-3.5 rounded-xl border border-teal-200">
                      <div className="flex items-center gap-1.5 font-bold text-teal-900 mb-1">
                        <ShieldAlert className="w-4 h-4 text-teal-600" />
                        <span>Late-Mark Deduction Policy</span>
                      </div>
                      <p className="text-xs text-teal-900 leading-relaxed">
                        Accumulating <strong className="font-bold">{shiftSettings.late_mark_threshold || 3} late marks</strong> in a single calendar month incurs a <strong>0.5 day leave deduction</strong> in payroll.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Office shift timing and grace policies are configured and managed centrally by Super Admin (Read-Only).</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. STAFF ROLES (MANAGER, AUDITOR, HR, ETC.): READ-ONLY STAFF SHIFT ONLY (EMPLOYEE SHIFT IS HIDDEN) */}
            {isStaffRole && (
              <div className="space-y-6 text-xs">
                <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-200">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800">
                        <Sliders className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {shiftSettings.staff_shift_name || 'Management & Staff Shift'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Special work timings configured for management and executive staff roles
                        </p>
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">Staff Shift Policy (Read-Only)</Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Staff Working Hours</div>
                      <div className="text-base font-bold text-slate-800 mt-1">
                        {shiftSettings.staff_start_time || '10:00 AM'} — {shiftSettings.staff_end_time || '07:00 PM'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Official Working Window</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Staff Grace Period</div>
                      <div className="text-base font-bold text-indigo-700 mt-1">
                        {shiftSettings.staff_grace_period_minutes || 15} Minutes
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Tolerance allowance</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Punctuality Cutoff</div>
                      <div className="text-base font-bold text-emerald-700 mt-1">
                        {(() => {
                          const startMins = parseTimeToMinutes(shiftSettings.staff_start_time || '10:00 AM') || 600;
                          const cutoff = startMins + Number(shiftSettings.staff_grace_period_minutes || 15);
                          const h = Math.floor(cutoff / 60);
                          const m = cutoff % 60;
                          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Punches up to this time are marked On-Time</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-indigo-100">
                    <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Staff Grace Period Allowance</span>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Punches up to <strong className="font-bold underline">{(() => {
                          const startMins = parseTimeToMinutes(shiftSettings.staff_start_time || '10:00 AM') || 600;
                          const cutoff = startMins + Number(shiftSettings.staff_grace_period_minutes || 15);
                          const h = Math.floor(cutoff / 60);
                          const m = cutoff % 60;
                          return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
                        })()}</strong> will <strong className="text-emerald-700">NOT</strong> be marked late for your role.
                      </p>
                    </div>

                    <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>Role Enrollment Status</span>
                      </div>
                      <p className="text-xs text-indigo-900 leading-relaxed">
                        Your role (<strong className="capitalize">{currentUser?.role ? currentUser.role.replace('_', ' ') : 'Staff'}</strong>) is enrolled under this executive shift.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-2.5 rounded-lg bg-indigo-50/80 border border-indigo-200/80 text-indigo-800 text-[11px] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>Executive shift timings and policies are configured and managed exclusively by Super Admin (Read-Only).</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Late Comers Policy Audit Table */}
          <Card
            title={`Late Arrivals & Penalty Audit — ${selectedMonth === 11 ? 'November' : selectedMonth} ${selectedYear}`}
            subtitle="Staff members who exceeded shift start time + grace period this calendar month"
          >
            {lateComersSummary.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">Excellent punctuality!</p>
                <p className="text-xs text-slate-400 mt-0.5">No late arrivals recorded for this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3 text-center">Late Marks This Month</th>
                      <th className="px-4 py-3">Policy Status</th>
                      <th className="px-4 py-3">Dates & Punch In Times</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {lateComersSummary.map((item) => (
                      <tr key={item.employee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{item.employee.first_name} {item.employee.last_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.employee.employee_code} · {item.employee.designation}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{item.employee.branch_name || 'Office'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-xs ${
                            item.penaltyTriggered
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {item.lateCount} / {shiftSettings?.late_mark_threshold || 3} Late
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.penaltyTriggered ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              ⚠️ {item.penaltyDays} Day Penalty Triggered (0.5D Deduction)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Within Tolerance Limit ({item.lateCount}/{shiftSettings?.late_mark_threshold || 3})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {item.lateDays.map((ld, idx) => (
                              <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                                <strong>{ld.date}</strong>: {ld.punchIn} <span className="text-amber-700 font-bold">(+{ld.lateInfo.minutesLate}m)</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* REGULARIZATION MODAL */}
      <Modal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        title="Request Attendance Regularization"
        subtitle="Submit missed punch justification for manager review"
      >
        <form onSubmit={handleRegSubmit} className="space-y-4 text-xs">
          {regModalError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {regModalError}
            </p>
          )}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date to Regularize:</label>
            <input
              type="date"
              required
              value={regDate}
              onChange={(e) => setRegDate(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Punch In Time:</label>
              <input
                type="text"
                required
                value={regIn}
                onChange={(e) => setRegIn(e.target.value)}
                placeholder="e.g. 09:30 AM"
                className="w-full p-2 rounded-lg border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM (e.g. 09:30 AM)</span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Requested Punch Out Time:</label>
              <input
                type="text"
                required
                value={regOut}
                onChange={(e) => setRegOut(e.target.value)}
                placeholder="e.g. 06:30 PM"
                className="w-full p-2 rounded-lg border border-slate-200 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Format: hh:mm AM/PM (e.g. 06:30 PM)</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Missed Punch / Client Onsite:</label>
            <textarea
              required
              rows="3"
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              placeholder="e.g. WiFi down, client visit at Kaushambi branch, biometric scanner unreadable..."
              className="w-full p-2.5 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowRegModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Regularization</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
