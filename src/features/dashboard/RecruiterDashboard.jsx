import React from 'react';
import {
  ArrowRight,
  Briefcase,
  Users,
  UserCheck,
  Clock,
  Star,
  Building2,
  CheckCircle2,
  Megaphone,
  UserPlus,
  Sparkles,
  Award,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHRMS } from '../../context/HRMSContext';

export default function RecruiterDashboard({ onNavigate }) {
  const { currentUser } = useAuth();
  const { recruitment, announcements } = useHRMS();

  const jobs = recruitment?.jobs || [];
  const candidates = recruitment?.candidates || [];

  const openJobs = jobs.filter((job) => job.status === 'Open');
  const totalVacancies = openJobs.reduce((sum, job) => sum + (Number(job.vacancies) || 0), 0);

  const appliedCount = candidates.filter((c) => c.stage === 'Applied').length;
  const screeningCount = candidates.filter((c) => c.stage === 'Screening').length;
  const interviewCount = candidates.filter((c) => c.stage === 'Interview').length;
  const offeredCount = candidates.filter((c) => c.stage === 'Offered').length;
  const hiredCount = candidates.filter((c) => c.stage === 'Hired').length;
  const rejectedCount = candidates.filter((c) => c.stage === 'Rejected').length;
  const activeCandidatesCount = appliedCount + screeningCount + interviewCount + offeredCount;

  const actionableCandidates = candidates
    .filter((c) => ['Screening', 'Interview', 'Offered'].includes(c.stage))
    .slice(0, 5);

  const latestAnnouncements = announcements?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Talent Acquisition Workspace
            </span>
            <span className="text-xs text-slate-500 font-medium">Pinweb ATS</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Recruiter Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage active job requisitions, candidate pipeline stages, and interview evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('recruitment')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition hover:from-emerald-700 hover:to-teal-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <Briefcase className="h-4 w-4" />
            Open Full ATS Board
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Recruitment Metrics Stat Cards */}
      <section aria-label="Recruitment Overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Open Jobs */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Briefcase className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              Active Hiring
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Open Job Requisitions</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{openJobs.length}</p>
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 text-[11px] text-slate-500">
            <span>{totalVacancies} open vacancy seats</span>
            <button
              type="button"
              onClick={() => onNavigate('recruitment')}
              className="font-semibold text-emerald-700 hover:underline"
            >
              View Jobs &rarr;
            </button>
          </div>
        </article>

        {/* Card 2: Total Active Candidates */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
              In Pipeline
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Active Candidates</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{activeCandidatesCount}</p>
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 text-[11px] text-slate-500">
            <span>{candidates.length} total applicants logged</span>
            <button
              type="button"
              onClick={() => onNavigate('recruitment')}
              className="font-semibold text-blue-700 hover:underline"
            >
              Pipeline &rarr;
            </button>
          </div>
        </article>

        {/* Card 3: Interviews in Progress */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Clock className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              Action Required
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">In Interview Stage</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{interviewCount}</p>
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 text-[11px] text-slate-500">
            <span>{screeningCount} awaiting screening</span>
            <button
              type="button"
              onClick={() => onNavigate('recruitment')}
              className="font-semibold text-amber-700 hover:underline"
            >
              Evaluate &rarr;
            </button>
          </div>
        </article>

        {/* Card 4: Offers & Hires */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Award className="h-6 w-6" />
            </span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
              Hiring Wins
            </span>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Hired & Offered</p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">{hiredCount + offeredCount}</p>
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 text-[11px] text-slate-500">
            <span>{hiredCount} hired, {offeredCount} offered</span>
            <button
              type="button"
              onClick={() => onNavigate('recruitment')}
              className="font-semibold text-teal-700 hover:underline"
            >
              Hires &rarr;
            </button>
          </div>
        </article>
      </section>

      {/* Pipeline Funnel Visual Stage Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Candidate Hiring Funnel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Live distribution of applicants across candidate evaluation stages</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('recruitment')}
            className="text-xs font-semibold text-emerald-700 hover:underline self-start sm:self-auto"
          >
            Open Kanban Board &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-3.5 text-center transition hover:border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">1. Applied</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{appliedCount}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">New Applications</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:p-3.5 text-center transition hover:border-blue-200">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">2. Screening</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{screeningCount}</p>
            <p className="text-[10px] text-blue-500 mt-0.5">Resume Review</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 sm:p-3.5 text-center transition hover:border-amber-200">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">3. Interview</p>
            <p className="mt-1 text-2xl font-bold text-amber-900">{interviewCount}</p>
            <p className="text-[10px] text-amber-500 mt-0.5">Assessment & Rating</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:p-3.5 text-center transition hover:border-indigo-200">
            <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">4. Offered</p>
            <p className="mt-1 text-2xl font-bold text-indigo-900">{offeredCount}</p>
            <p className="text-[10px] text-indigo-500 mt-0.5">Offer Extended</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:p-3.5 text-center transition hover:border-emerald-200">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">5. Hired</p>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{hiredCount}</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">Converted to Staff</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 sm:p-3.5 text-center transition hover:border-rose-200">
            <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">6. Rejected</p>
            <p className="mt-1 text-2xl font-bold text-rose-900">{rejectedCount}</p>
            <p className="text-[10px] text-rose-500 mt-0.5">Not Selected</p>
          </div>
        </div>
      </section>

      {/* Main Grid: Active Requisitions + Recent Candidates */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        {/* Left Card: Active Job Openings */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Job Requisitions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Open vacancies currently accepting candidates</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('recruitment')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Manage Jobs <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100 flex-1">
            {openJobs.length > 0 ? (
              openJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">{job.title}</p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">
                        {job.vacancies} {job.vacancies === 1 ? 'vacancy' : 'vacancies'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {job.department || 'General'}
                      </span>
                      {job.experience && (
                        <span>Exp: {job.experience}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('recruitment')}
                    className="shrink-0 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg px-2.5 py-1.5 transition"
                  >
                    View Pipeline
                  </button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <Briefcase className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No active job requisitions found. Click "Open Full ATS Board" to post a new job opening.
              </div>
            )}
          </div>
        </article>

        {/* Right Column: Actionable Candidates + Announcements */}
        <div className="space-y-5">
          {/* Card: Candidates in Active Review */}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Candidates in Review</h2>
                <p className="text-xs text-slate-500 mt-0.5">Awaiting interview rating or stage decision</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('recruitment')}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                View all &rarr;
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {actionableCandidates.length > 0 ? (
                actionableCandidates.map((c) => {
                  const stageStyles = {
                    Screening: 'bg-blue-50 text-blue-700 border-blue-200',
                    Interview: 'bg-amber-50 text-amber-700 border-amber-200',
                    Offered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  }[c.stage] || 'bg-slate-50 text-slate-700 border-slate-200';

                  return (
                    <div key={c.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'}
                          </p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${stageStyles}`}>
                            {c.stage}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Applied: {c.job_title || 'General Position'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.rating ? (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                            {c.rating}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onNavigate('recruitment')}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 hover:bg-emerald-50 rounded-lg transition"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-xs text-slate-500">
                  No pending candidates awaiting evaluation.
                </p>
              )}
            </div>
          </article>

          {/* Card: Latest Announcements */}
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-50 p-1.5 text-teal-700">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Company Announcements</h2>
                  <p className="text-xs text-slate-500">Updates published for your organization</p>
                </div>
              </div>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {latestAnnouncements.length > 0 ? (
                latestAnnouncements.map((item) => (
                  <div key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.message}</p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs text-slate-500">No company announcements.</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
