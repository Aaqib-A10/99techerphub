import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    templateKey: 'OFFER_PERMANENT',
    name: 'Offer Letter - Permanent Employee',
    category: 'OFFER',
    subject: 'Offer of Employment - {{position}} at 99 Technologies',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 30px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .greeting { margin-bottom: 20px; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; color: #00C853; margin-top: 15px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table td { padding: 10px; border-bottom: 1px solid #ddd; }
    table .label { font-weight: bold; width: 40%; background-color: #f0f0f0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offer of Employment</h1>
      <p style="margin: 5px 0;">99 Technologies</p>
    </div>

    <div class="content">
      <div class="greeting">
        <p>Dear {{candidate_name}},</p>
        <p>We are delighted to extend to you an offer of employment as a {{position}} at 99 Technologies. After careful consideration of your qualifications and experience, we believe you will be a valuable addition to our team.</p>
      </div>

      <div class="section">
        <div class="section-title">Employment Details</div>
        <table>
          <tr>
            <td class="label">Position:</td>
            <td>{{position}}</td>
          </tr>
          <tr>
            <td class="label">Department:</td>
            <td>{{department}}</td>
          </tr>
          <tr>
            <td class="label">Company:</td>
            <td>{{company_name}}</td>
          </tr>
          <tr>
            <td class="label">Start Date:</td>
            <td>{{start_date}}</td>
          </tr>
          <tr>
            <td class="label">Employment Type:</td>
            <td>Permanent</td>
          </tr>
          <tr>
            <td class="label">Reporting To:</td>
            <td>{{reporting_to}}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">Compensation & Benefits</div>
        <table>
          <tr>
            <td class="label">Base Salary:</td>
            <td>{{salary}} {{currency}} per month</td>
          </tr>
          <tr>
            <td class="label">Payment Schedule:</td>
            <td>Monthly, on the last working day</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <p>Please note that this offer is contingent upon the successful completion of background verification and relevant documentation checks.</p>
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Please confirm your acceptance of this offer within 5 business days</li>
          <li>Submit required documents (CNIC, education certificates, previous employment letters)</li>
          <li>Complete our onboarding process before your start date</li>
          <li>Maintain confidentiality regarding the terms of this offer</li>
        </ol>
      </div>

      <div class="section">
        <p>We look forward to your positive response. Should you have any questions regarding this offer, please do not hesitate to contact our Human Resources department.</p>
        <p>Welcome to 99 Technologies!</p>
      </div>
    </div>

    <div class="footer">
      <p><strong>99 Technologies</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'candidate_name',
      'position',
      'department',
      'company_name',
      'start_date',
      'salary',
      'currency',
      'reporting_to',
    ],
    description: 'Standard offer letter for permanent employees',
  },

  {
    templateKey: 'OFFER_PROBATION',
    name: 'Offer Letter - Probationary Employee',
    category: 'OFFER',
    subject: 'Probationary Offer - {{position}} at 99 Technologies',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 30px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .section-title { font-weight: bold; color: #00C853; margin-top: 15px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table td { padding: 10px; border-bottom: 1px solid #ddd; }
    table .label { font-weight: bold; width: 40%; background-color: #f0f0f0; }
    .alert { background-color: #FFF3E0; padding: 15px; border-left: 4px solid #FF9800; margin: 15px 0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Probationary Offer of Employment</h1>
      <p style="margin: 5px 0;">99 Technologies</p>
    </div>

    <div class="content">
      <p>Dear {{candidate_name}},</p>
      <p>We are pleased to extend an offer of employment on a probationary basis for the position of {{position}} at 99 Technologies.</p>

      <div class="section-title">Employment Terms</div>
      <table>
        <tr>
          <td class="label">Position:</td>
          <td>{{position}}</td>
        </tr>
        <tr>
          <td class="label">Start Date:</td>
          <td>{{start_date}}</td>
        </tr>
        <tr>
          <td class="label">Probation Period:</td>
          <td>{{probation_period}}</td>
        </tr>
        <tr>
          <td class="label">Salary:</td>
          <td>{{salary}} {{currency}} per month</td>
        </tr>
      </table>

      <div class="alert">
        <strong>Important:</strong> This is a probationary appointment. Your continuation beyond the probation period will be based on satisfactory performance, conduct, and completion of background verification.
      </div>

      <p><strong>Probation Period Expectations:</strong></p>
      <ul>
        <li>Demonstrate competency in assigned responsibilities</li>
        <li>Adhere to company policies and procedures</li>
        <li>Maintain professional conduct and punctuality</li>
        <li>Successfully complete mandatory training and onboarding</li>
        <li>Meet performance targets as set by your manager</li>
      </ul>

      <p>Upon satisfactory completion of the probation period, your employment will be confirmed in writing.</p>
      <p>Please confirm your acceptance of this offer within 5 business days.</p>
      <p>We look forward to welcoming you to our team!</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'candidate_name',
      'position',
      'start_date',
      'probation_period',
      'salary',
      'currency',
    ],
    description: 'Offer letter for probationary employees with probation period terms',
  },

  {
    templateKey: 'OFFER_CONSULTANT',
    name: 'Consultancy Engagement Letter',
    category: 'OFFER',
    subject: 'Consultancy Engagement - {{position}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 30px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .section-title { font-weight: bold; color: #00C853; margin-top: 15px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table td { padding: 10px; border-bottom: 1px solid #ddd; }
    table .label { font-weight: bold; width: 40%; background-color: #f0f0f0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Consultancy Engagement Letter</h1>
      <p style="margin: 5px 0;">99 Technologies</p>
    </div>

    <div class="content">
      <p>Dear {{candidate_name}},</p>
      <p>We are delighted to engage your services as a Consultant for {{position}}. Your expertise and experience will be valuable to our organization.</p>

      <div class="section-title">Engagement Details</div>
      <table>
        <tr>
          <td class="label">Role:</td>
          <td>{{position}} (Consultant)</td>
        </tr>
        <tr>
          <td class="label">Start Date:</td>
          <td>{{start_date}}</td>
        </tr>
        <tr>
          <td class="label">Engagement Type:</td>
          <td>Consultant</td>
        </tr>
        <tr>
          <td class="label">Monthly Fee:</td>
          <td>{{salary}} {{currency}}</td>
        </tr>
      </table>

      <div class="section-title">Compensation Structure</div>
      <p>Your compensation will consist of:</p>
      <ul>
        <li><strong>Monthly Fee:</strong> {{salary}} {{currency}} (paid on the last working day)</li>
        <li><strong>Commission Structure:</strong> {{commission_structure}}</li>
      </ul>

      <div class="section-title">Terms & Conditions</div>
      <ul>
        <li>This is a consultant engagement, not an employment relationship</li>
        <li>You will be responsible for your own tax obligations and benefits</li>
        <li>Flexible working arrangements as mutually agreed</li>
        <li>All deliverables and intellectual property created remain the property of 99 Technologies</li>
        <li>Confidentiality obligations as per contract terms</li>
      </ul>

      <p>Please review the attached detailed consultancy agreement and confirm your acceptance within 5 business days.</p>
      <p>We look forward to a productive engagement!</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'candidate_name',
      'position',
      'start_date',
      'salary',
      'currency',
      'commission_structure',
    ],
    description: 'Engagement letter for consultants with commission structure details',
  },

  {
    templateKey: 'ONBOARDING_INVITE',
    name: 'Onboarding Invitation',
    category: 'ONBOARDING',
    subject: 'Welcome to 99 Technologies - Complete Your Onboarding',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 30px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .cta-button { display: inline-block; background-color: #00C853; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: bold; }
    .checklist { background-color: #ffffff; padding: 20px; border-left: 4px solid #00C853; margin: 20px 0; }
    .checklist li { margin: 8px 0; }
    .timeline { margin: 20px 0; }
    .timeline-item { padding: 10px; border-left: 4px solid #00C853; margin: 10px 0; padding-left: 15px; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
    .note { font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome!</h1>
      <p style="margin: 10px 0; font-size: 18px;">We're excited to have you join 99 Technologies</p>
    </div>

    <div class="content">
      <p>Dear {{candidate_name}},</p>
      <p>Congratulations on joining 99 Technologies! We're thrilled to have you as part of our team. To ensure a smooth transition, we've prepared an onboarding process to help you get up to speed.</p>

      <p style="text-align: center;">
        <a href="{{onboarding_url}}" class="cta-button">Start Your Onboarding</a>
      </p>

      <div class="checklist">
        <strong>Your Onboarding Checklist:</strong>
        <ul>
          <li>✓ Complete personal and employment information</li>
          <li>✓ Provide banking details for salary processing</li>
          <li>✓ Upload required documents (CNIC, education certificates, etc.)</li>
          <li>✓ Acknowledge company policies and code of conduct</li>
          <li>✓ Set up emergency contact information</li>
          <li>✓ Configure digital access and systems</li>
        </ul>
      </div>

      <div class="timeline">
        <strong>Timeline:</strong>
        <div class="timeline-item">
          <strong>By {{start_date}}:</strong> Complete all onboarding tasks
        </div>
        <div class="timeline-item">
          <strong>Day 1:</strong> Welcome orientation and office tour
        </div>
        <div class="timeline-item">
          <strong>Week 1:</strong> Department introduction and team meetings
        </div>
      </div>

      <p><strong>Important Information:</strong></p>
      <ul>
        <li>Your onboarding access link will expire on {{expiry_date}}</li>
        <li>All information submitted is confidential and secure</li>
        <li>If you encounter any issues, please contact HR immediately</li>
        <li>Estimated time to complete: 20-30 minutes</li>
      </ul>

      <p>If you have any questions or need assistance, our HR team is here to help. Feel free to reach out anytime!</p>
      <p>Looking forward to seeing you soon!</p>

      <div class="note">
        <p><em>This link is unique to you and will expire on {{expiry_date}}. For security reasons, do not share this link with anyone.</em></p>
      </div>
    </div>

    <div class="footer">
      <p><strong>99 Technologies - Human Resources</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: ['candidate_name', 'onboarding_url', 'expiry_date', 'start_date'],
    description: 'Welcome email with onboarding link and checklist',
  },

  {
    templateKey: 'EXPENSE_APPROVED',
    name: 'Expense Approved Notification',
    category: 'EXPENSE',
    subject: 'Your expense {{expense_number}} has been approved',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .status-badge { display: inline-block; background-color: #4CAF50; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table th { background-color: #f0f0f0; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
    table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Expense Approved! ✓</h1>
    </div>

    <div class="content">
      <p>Dear {{employee_name}},</p>
      <p>We're pleased to inform you that your expense has been <span class="status-badge">APPROVED</span></p>

      <table>
        <tr>
          <th colspan="2">Expense Details</th>
        </tr>
        <tr>
          <td><strong>Expense Number:</strong></td>
          <td>{{expense_number}}</td>
        </tr>
        <tr>
          <td><strong>Amount:</strong></td>
          <td><span class="amount">{{amount}}</span></td>
        </tr>
        <tr>
          <td><strong>Approved By:</strong></td>
          <td>{{approver_name}}</td>
        </tr>
        <tr>
          <td><strong>Approval Date:</strong></td>
          <td>{{approval_date}}</td>
        </tr>
      </table>

      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Your reimbursement will be processed within 5-7 business days</li>
        <li>The amount will be transferred to your registered bank account</li>
        <li>You will receive a separate confirmation once the payment is made</li>
      </ul>

      <p>Thank you for your submission and for managing your expenses responsibly.</p>
      <p>If you have any questions, please contact the Finance department.</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies - Finance Department</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'employee_name',
      'expense_number',
      'amount',
      'approver_name',
      'approval_date',
    ],
    description: 'Notification when an expense is approved for reimbursement',
  },

  {
    templateKey: 'EXPENSE_REJECTED',
    name: 'Expense Rejected Notification',
    category: 'EXPENSE',
    subject: 'Expense {{expense_number}} needs your attention',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .alert { background-color: #FFF3E0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
    .status-badge { display: inline-block; background-color: #FF9800; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    table th { background-color: #f0f0f0; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
    table td { padding: 10px; border-bottom: 1px solid #ddd; }
    .action-box { background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Expense Needs Attention</h1>
    </div>

    <div class="content">
      <p>Dear {{employee_name}},</p>
      <p>Your expense submission {{expense_number}} has been <span class="status-badge">REJECTED</span> and requires your attention.</p>

      <div class="alert">
        <strong>Reason for Rejection:</strong><br>
        {{rejection_reason}}
      </div>

      <table>
        <tr>
          <th colspan="2">Expense Details</th>
        </tr>
        <tr>
          <td><strong>Expense Number:</strong></td>
          <td>{{expense_number}}</td>
        </tr>
        <tr>
          <td><strong>Submitted Amount:</strong></td>
          <td>{{amount}}</td>
        </tr>
        <tr>
          <td><strong>Rejected By:</strong></td>
          <td>{{approver_name}}</td>
        </tr>
      </table>

      <div class="action-box">
        <strong>What You Need to Do:</strong>
        <ol>
          <li>Review the rejection reason carefully</li>
          <li>Gather any missing supporting documents or receipts</li>
          <li>Correct the expense details if needed</li>
          <li>Resubmit the expense with the required corrections</li>
        </ol>
      </div>

      <p><strong>Common Reasons for Rejection:</strong></p>
      <ul>
        <li>Missing receipts or supporting documentation</li>
        <li>Expense exceeds approved limits</li>
        <li>Non-business related expense</li>
        <li>Incorrect category or amount</li>
      </ul>

      <p>If you have questions about the rejection, please contact the Finance department or your manager.</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies - Finance Department</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'employee_name',
      'expense_number',
      'amount',
      'rejection_reason',
      'approver_name',
    ],
    description: 'Notification when an expense is rejected with reason for revision',
  },

  {
    templateKey: 'PAYROLL_PROCESSED',
    name: 'Payslip Notification',
    category: 'PAYROLL',
    subject: 'Payslip for {{period}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .summary-box { background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .summary-row:last-child { border-bottom: none; }
    .summary-label { font-weight: bold; }
    .amount { text-align: right; font-weight: bold; }
    .net-pay { background-color: #E8F5E9; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .net-pay-amount { font-size: 28px; color: #00C853; font-weight: bold; }
    .payment-details { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #00C853; margin: 20px 0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Salary Has Been Processed</h1>
      <p style="margin: 5px 0;">{{period}}</p>
    </div>

    <div class="content">
      <p>Dear {{employee_name}},</p>
      <p>Your salary for {{period}} has been successfully processed and will be credited to your account on {{payment_date}}.</p>

      <div class="net-pay">
        <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Your Net Salary</div>
        <div class="net-pay-amount">{{net_pay}}</div>
      </div>

      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Base Salary:</span>
          <span class="amount">{{base_salary}}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Allowances:</span>
          <span class="amount">{{allowances}}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Gross Salary:</span>
          <span class="amount">{{gross_salary}}</span>
        </div>
        <div class="summary-row" style="border-bottom: 2px solid #ddd;">
          <span class="summary-label">Deductions:</span>
          <span class="amount">{{deductions}}</span>
        </div>
        <div class="summary-row" style="font-size: 16px; margin-top: 10px;">
          <span class="summary-label">Net Salary:</span>
          <span class="amount" style="color: #00C853;">{{net_pay}}</span>
        </div>
      </div>

      <div class="payment-details">
        <strong>Payment Information:</strong>
        <p style="margin: 10px 0 5px 0;"><strong>Payment Date:</strong> {{payment_date}}</p>
        <p style="margin: 5px 0;"><strong>Payment Method:</strong> Bank Transfer</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">Please allow 1-2 business days for the amount to reflect in your account.</p>
      </div>

      <p><strong>Important Notes:</strong></p>
      <ul>
        <li>Keep this email for your records</li>
        <li>For detailed payslip, log into the Employee Portal</li>
        <li>If you notice any discrepancies, contact HR immediately</li>
        <li>Tax compliance is already deducted as per regulations</li>
      </ul>

      <p>Thank you for your continued service to 99 Technologies.</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies - Finance Department</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'employee_name',
      'period',
      'net_pay',
      'payment_date',
      'base_salary',
      'allowances',
      'gross_salary',
      'deductions',
    ],
    description: 'Payslip notification with salary breakdown and payment date',
  },

  {
    templateKey: 'ASSET_ASSIGNED',
    name: 'Asset Assignment Notification',
    category: 'ASSET',
    subject: 'Asset Assigned - {{asset_tag}}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00C853; color: white; padding: 20px; text-align: center; border-radius: 4px 4px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .asset-details { background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 4px; margin: 20px 0; }
    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: bold; width: 40%; color: #00C853; }
    .detail-value { width: 60%; }
    .terms-box { background-color: #FFF9C4; padding: 20px; border-left: 4px solid #FBC02D; margin: 20px 0; border-radius: 4px; }
    .checklist { background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin: 20px 0; }
    .footer { background-color: #E8F5E9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 4px 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Asset Assignment Notice</h1>
      <p style="margin: 5px 0;">{{asset_tag}} has been assigned to you</p>
    </div>

    <div class="content">
      <p>Dear {{employee_name}},</p>
      <p>The following asset has been officially assigned to you for your use at 99 Technologies. Please review the details below and acknowledge receipt.</p>

      <div class="asset-details">
        <h3 style="margin-top: 0; color: #00C853;">Asset Information</h3>
        <div class="detail-row">
          <div class="detail-label">Asset Tag:</div>
          <div class="detail-value">{{asset_tag}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Equipment Type:</div>
          <div class="detail-value">{{asset_category}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Model/Description:</div>
          <div class="detail-value">{{model}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Serial Number:</div>
          <div class="detail-value">{{serial_number}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Assignment Date:</div>
          <div class="detail-value">{{assignment_date}}</div>
        </div>
        <div class="detail-row">
          <div class="detail-label">Assigned By:</div>
          <div class="detail-value">{{assigned_by}}</div>
        </div>
      </div>

      <div class="terms-box">
        <strong>⚠️ Asset Custody Terms</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>You are responsible for the care and safekeeping of this asset</li>
          <li>Use this asset only for business purposes</li>
          <li>Report any damage, loss, or theft immediately to IT/Admin</li>
          <li>Do not lend, modify, or transfer the asset without permission</li>
          <li>Return the asset in good condition upon departure or reassignment</li>
          <li>All data on this asset belongs to 99 Technologies</li>
        </ul>
      </div>

      <div class="checklist">
        <strong>Action Required:</strong>
        <ol>
          <li>Verify that you have received the asset in good condition</li>
          <li>Check that the serial number matches this notification</li>
          <li>Acknowledge this assignment in the Employee Portal</li>
          <li>Report any issues within 24 hours</li>
        </ol>
      </div>

      <p>For any questions or issues regarding this asset, please contact the Administration or IT department.</p>
      <p>Thank you!</p>
    </div>

    <div class="footer">
      <p><strong>99 Technologies - Administration</strong></p>
      <p>Eagan, MN (USA) | Dubai (UAE) | Islamabad (Pakistan)</p>
      <p>www.99technologies.com</p>
    </div>
  </div>
</body>
</html>
    `,
    mergeFields: [
      'employee_name',
      'asset_tag',
      'asset_category',
      'model',
      'serial_number',
      'assignment_date',
      'assigned_by',
    ],
    description: 'Notification when an asset is assigned to an employee',
  },
];

async function main() {
  try {
    for (const template of templates) {
      await prisma.emailTemplate.upsert({
        where: { templateKey: template.templateKey },
        update: template,
        create: {
          ...template,
          mergeFields: template.mergeFields,
        },
      });
    }
    console.log(`✓ Seeded ${templates.length} email templates successfully`);
  } catch (error) {
    console.error('Error seeding email templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
