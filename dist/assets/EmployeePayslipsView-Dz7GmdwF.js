import{b,r as c,h as f,j as t,C as g,B as y,D as w,e as v,F as _}from"./index-DQ0WKcfV.js";const j=new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2});function p(e){return j.format(Number(e)||0)}function n(e){return String(e??"—").replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}function N(e){const r=`${e.first_name} ${e.last_name}`,o=[["Gross Salary",e.gross_salary],["Basic Salary",e.basic_salary],["House Rent Allowance",e.hra],["Special Allowance",e.special_allowance]],i=[["Employee Provident Fund",e.pf_employee],["Employee State Insurance",e.esi_employee],["Professional Tax",e.professional_tax],["Tax Deducted at Source",e.tds],["Total Deductions",e.total_deductions]],d=l=>l.map(([m,x])=>`<tr><th>${n(m)}</th><td>${n(p(x))}</td></tr>`).join("");return`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${n(e.month_name)} Payslip</title>
        <style>
          body{font:14px Arial,sans-serif;color:#172033;margin:40px auto;max-width:760px}
          header{border-bottom:2px solid #172033;margin-bottom:24px;padding-bottom:16px}
          h1{font-size:22px;margin:0 0 6px}p{margin:5px 0;color:#475569}
          .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin:24px 0}
          table{border-collapse:collapse;width:100%;margin:16px 0}
          th,td{border-bottom:1px solid #dbe1ea;padding:10px;text-align:left}
          td{text-align:right;font-variant-numeric:tabular-nums}
          .net{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;font-size:18px;font-weight:700}
          @media print{body{margin:0;max-width:none}}
        </style>
      </head>
      <body>
        <header><h1>Salary Payslip</h1><p>${n(e.month_name)}</p></header>
        <section class="meta">
          <div><strong>Employee:</strong> ${n(r)}</div>
          <div><strong>Employee code:</strong> ${n(e.employee_code)}</div>
          <div><strong>Designation:</strong> ${n(e.designation)}</div>
          <div><strong>Period:</strong> ${n(e.period_month)}/${n(e.period_year)}</div>
        </section>
        <table><tbody>${d(o)}</tbody></table>
        <table><tbody>${d(i)}</tbody></table>
        <p class="net">Net salary: ${n(p(e.net_salary))}</p>
        <p>Confidential employee document. Tax and professional tax amounts are recorded as reviewed by Payroll.</p>
      </body>
    </html>`}function P(e,r){const o=window.open("","_blank","width=800,height=700");if(!o){r("Allow pop-ups to print or save this payslip as a PDF.");return}o.addEventListener("load",()=>o.print(),{once:!0}),o.document.open(),o.document.write(N(e)),o.document.close(),o.focus()}function $(){const{currentUser:e}=b(),[r,o]=c.useState([]),[i,d]=c.useState(!0),[l,m]=c.useState(""),[x,h]=c.useState("");return c.useEffect(()=>{if(!(e!=null&&e.employee_id)){m("This account is not linked to an employee record."),d(!1);return}let a=!0;return f.getMyPayslips().then(s=>{a&&o(Array.isArray(s==null?void 0:s.data)?s.data:[])}).catch(s=>{var u;a&&m(((u=s==null?void 0:s.data)==null?void 0:u.message)||s.message||"Unable to load your payslips.")}).finally(()=>{a&&d(!1)}),()=>{a=!1}},[e==null?void 0:e.employee_id]),t.jsxs("div",{className:"space-y-6",children:[t.jsxs("header",{children:[t.jsx("span",{className:"text-xs font-bold uppercase tracking-wide text-emerald-700",children:"Employee self-service"}),t.jsx("h1",{className:"mt-1 text-2xl font-bold text-slate-900",children:"My Payslips"}),t.jsx("p",{className:"mt-1 text-sm text-slate-600",children:"View and print only your finalized salary statements. Payroll publishes each slip after deduction review."})]}),l&&t.jsx("div",{role:"alert",className:"rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800",children:l}),x&&t.jsx("div",{role:"alert",className:"rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",children:x}),i&&t.jsx("p",{role:"status",className:"text-sm text-slate-500",children:"Loading your finalized payslips…"}),!i&&!l&&r.length===0&&t.jsx(g,{title:"No payslips available",children:t.jsx("p",{className:"text-sm text-slate-600",children:"Finalized payslips will appear here after Payroll reviews and publishes your monthly run."})}),t.jsx("div",{className:"space-y-4",children:r.map(a=>t.jsxs(g,{title:a.month_name,subtitle:`${a.employee_code} · ${a.designation}`,action:t.jsx(v,{variant:a.payment_status==="paid"?"success":"warning",size:"sm",children:a.payment_status==="paid"?"Paid":"Finalized"}),children:[t.jsxs("div",{className:"grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3",children:[[["Gross salary",a.gross_salary],["Basic salary",a.basic_salary],["House rent allowance",a.hra],["Special allowance",a.special_allowance],["Employee PF",a.pf_employee],["Employee ESI",a.esi_employee],["Professional tax",a.professional_tax],["TDS",a.tds],["Total deductions",a.total_deductions]].map(([s,u])=>t.jsxs("div",{className:"rounded-lg border border-slate-100 bg-slate-50 p-3",children:[t.jsx("span",{className:"block text-xs text-slate-500",children:s}),t.jsx("strong",{className:"mt-1 block text-slate-900",children:p(u)})]},s)),t.jsxs("div",{className:"rounded-lg border border-emerald-200 bg-emerald-50 p-3",children:[t.jsx("span",{className:"block text-xs text-emerald-800",children:"Net salary"}),t.jsx("strong",{className:"mt-1 block text-lg text-emerald-800",children:p(a.net_salary)})]})]}),t.jsxs("div",{className:"mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4",children:[t.jsx("p",{className:"text-xs text-slate-500",children:"TDS and professional tax were reviewed before publication."}),t.jsx(y,{type:"button",variant:"secondary",icon:w,onClick:()=>{h(""),P(a,h)},children:"Print / Save as PDF"})]})]},a.id))}),!i&&!l&&r.length>0&&t.jsxs("p",{className:"flex items-center gap-2 text-xs text-slate-500",children:[t.jsx(_,{className:"h-4 w-4"}),"Payslip access is limited to the employee account linked to this session."]})]})}export{$ as default};
