import React, { useState } from 'react';
import { 
  Mail, CheckSquare, Search, Send, Clock, Star, Paperclip, 
  MoreHorizontal, Plus, Reply, Archive, Trash2, Tag, CheckCircle2,
  AlertCircle, ChevronRight, CornerDownLeft
} from 'lucide-react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';

interface EmailItem {
  id: string;
  sender: string;
  senderEmail: string;
  title: string;
  initials: string;
  avatarColor: string;
  subject: string;
  preview: string;
  body: string[];
  timestamp: string;
  unread: boolean;
  tag: string;
}

interface KanbanTask {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  assignee: string;
  assigneeInitials: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
}

const EMAILS: EmailItem[] = [
  {
    id: '1',
    sender: 'David Vance',
    senderEmail: 'david.vance@acmecorp.internal',
    title: 'Director of Information Security',
    initials: 'DV',
    avatarColor: '#335CFF',
    subject: 'Q3 Enterprise Zero-Trust & Biometrics Policy Deployment',
    preview: 'Please review the updated biometric authentication policy before Friday COB...',
    body: [
      'Team,',
      'As part of our Q3 compliance audit, we are transitioning all engineering and finance workstations to continuous behavioral verification via TrustLoop.',
      'This deployment requires zero active hardware setup. Your normal typing cadences, dwell latencies, and cursor trajectory acceleration curves will dynamically establish your localized security baseline during daily tasks.',
      'Please reply directly to this thread if you encounter any unexpected session challenge prompts or hardware peripheral latency.',
      'Best regards,',
      'David Vance | Information Security Operations'
    ],
    timestamp: '10:42 AM',
    unread: true,
    tag: 'Compliance'
  },
  {
    id: '2',
    sender: 'Sarah Jenkins',
    senderEmail: 's.jenkins@acmecorp.internal',
    title: 'Lead Systems Architect',
    initials: 'SJ',
    avatarColor: '#7F56D9',
    subject: 'Action Required: Production Database Migration Window',
    preview: 'The database schema cutover is scheduled for Saturday 02:00 UTC...',
    body: [
      'Hi everyone,',
      'The scheduled PostgreSQL cluster migration to version 16 will take place this Saturday morning between 02:00 and 04:30 UTC.',
      'All read-replicas will be placed in maintenance mode for approximately 20 minutes during the primary failover.',
      'Please ensure all pending PRs targeting main are merged before Friday 18:00 UTC.',
      'Thanks,',
      'Sarah Jenkins'
    ],
    timestamp: '09:15 AM',
    unread: true,
    tag: 'Infrastructure'
  },
  {
    id: '3',
    sender: 'Marcus Brody',
    senderEmail: 'm.brody@acmecorp.internal',
    title: 'People Operations Lead',
    initials: 'MB',
    avatarColor: '#12B76A',
    subject: 'Annual Open Enrollment & Benefits Selection Period',
    preview: 'Open enrollment for health, dental, and 401(k) matching opens next Monday...',
    body: [
      'Hello Acme Team,',
      'A quick reminder that our annual benefits selection window opens on Monday, October 1st and closes on October 15th.',
      'You can review plan comparison matrices and schedule 1-on-1 advisor consultations through the internal HR portal.',
      'Feel free to reach out if you have any questions regarding dependent coverage changes.',
      'Warmly,',
      'Marcus Brody'
    ],
    timestamp: 'Yesterday',
    unread: false,
    tag: 'HR & Benefits'
  },
  {
    id: '4',
    sender: 'Elena Rostova',
    senderEmail: 'elena.r@acmecorp.internal',
    title: 'Senior Product Manager',
    initials: 'ER',
    avatarColor: '#F79009',
    subject: 'Customer Feedback Summary: Enterprise Dashboard v2',
    preview: 'Key takeaways from our UX research sessions with enterprise pilot clients...',
    body: [
      'Hi team,',
      'We wrapped up 12 customer discovery sessions this week regarding the new unified analytics console.',
      'Overall sentiment is extremely positive—specifically the transparency of risk factor breakdowns and the instantaneous session lock overlay upon credential tampering.',
      'Let’s review the detailed feedback during tomorrow’s sprint grooming.',
      'Elena'
    ],
    timestamp: 'Sep 24',
    unread: false,
    tag: 'Product'
  }
];

const INITIAL_TASKS: Record<string, KanbanTask[]> = {
  todo: [
    { id: 't1', title: 'Audit VPC ingress security groups', tag: 'SecOps', tagColor: '#335CFF', assignee: 'Alice Smith', assigneeInitials: 'AS', dueDate: 'Tomorrow', priority: 'High' },
    { id: 't2', title: 'Implement rate-limiting for OAuth token exchange', tag: 'Backend', tagColor: '#7F56D9', assignee: 'Bob Jones', assigneeInitials: 'BJ', dueDate: 'Oct 02', priority: 'Medium' },
    { id: 't3', title: 'Update internal compliance runbook documentation', tag: 'Documentation', tagColor: '#667085', assignee: 'Alice Smith', assigneeInitials: 'AS', dueDate: 'Oct 05', priority: 'Low' },
  ],
  in_progress: [
    { id: 't4', title: 'Deploy TrustLoop behavioral daemon to staging fleet', tag: 'Infra', tagColor: '#12B76A', assignee: 'Alice Smith', assigneeInitials: 'AS', dueDate: 'Today', priority: 'High' },
    { id: 't5', title: 'Refactor feature extractor windowing buffer', tag: 'ML Ops', tagColor: '#F79009', assignee: 'Bob Jones', assigneeInitials: 'BJ', dueDate: 'Friday', priority: 'Medium' },
  ],
  done: [
    { id: 't6', title: 'Migrate user password hashes to argon2/bcrypt', tag: 'Security', tagColor: '#12B76A', assignee: 'Alice Smith', assigneeInitials: 'AS', dueDate: 'Completed', priority: 'High' },
    { id: 't7', title: 'Setup telemetry pipeline for anomaly contribution telemetry', tag: 'Analytics', tagColor: '#335CFF', assignee: 'Alice Smith', assigneeInitials: 'AS', dueDate: 'Completed', priority: 'Medium' },
  ]
};

export default function Workspace() {
  const [activeView, setActiveView] = useState<'email' | 'kanban'>('email');
  const [selectedEmailId, setSelectedEmailId] = useState<string>('1');
  const [replyText, setReplyText] = useState('');
  const [replySentSuccess, setReplySentSuccess] = useState(false);
  
  const [kanbanTasks, setKanbanTasks] = useState(INITIAL_TASKS);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);

  const { isEnrolled } = useEmployeeContext();
  const selectedEmail = EMAILS.find(e => e.id === selectedEmailId) || EMAILS[0];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplySentSuccess(true);
    setReplyText('');
    setTimeout(() => setReplySentSuccess(false), 3500);
  };

  const handleAddTask = (columnKey: string) => {
    if (!newTaskTitle.trim()) return;
    const newTask: KanbanTask = {
      id: `t_${Date.now()}`,
      title: newTaskTitle.trim(),
      tag: 'Task',
      tagColor: '#335CFF',
      assignee: 'Alice Smith',
      assigneeInitials: 'AS',
      dueDate: 'Next Week',
      priority: 'Medium'
    };
    setKanbanTasks(prev => ({
      ...prev,
      [columnKey]: [newTask, ...prev[columnKey]]
    }));
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Workspace Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            Enterprise Workspace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            {!isEnrolled 
              ? "Interact naturally with corporate mail and project boards to establish your baseline profile." 
              : "Continuous behavioral verification active. Interacting with daily tasks verifies your live identity."}
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setActiveView('email')}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: activeView === 'email' ? 'var(--bg-surface)' : 'transparent',
              color: activeView === 'email' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeView === 'email' ? '600' : '500',
              boxShadow: activeView === 'email' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.15s'
            }}
          >
            <Mail size={15} /> Corporate Mail
          </button>
          <button
            type="button"
            onClick={() => setActiveView('kanban')}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: activeView === 'kanban' ? 'var(--bg-surface)' : 'transparent',
              color: activeView === 'kanban' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeView === 'kanban' ? '600' : '500',
              boxShadow: activeView === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', transition: 'all 0.15s'
            }}
          >
            <CheckSquare size={15} /> Sprint Kanban
          </button>
        </div>
      </div>

      {/* EMAIL CLIENT VIEW */}
      {activeView === 'email' && (
        <div className="card" style={{ flex: 1, padding: 0, display: 'grid', gridTemplateColumns: '380px 1fr', overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left Pane: Inbox List */}
          <div style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
            
            {/* Search Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                type="text"
                placeholder="Search inbox, senders, or tags..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Email Items List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {EMAILS.map((email) => {
                const isSelected = email.id === selectedEmailId;
                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmailId(email.id)}
                    style={{
                      padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(51, 92, 255, 0.06)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Avatar */}
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: email.avatarColor, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {email.initials}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: email.unread ? '700' : '600', color: 'var(--text-primary)' }}>
                          {email.sender}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {email.unread && (
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }}></span>
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{email.timestamp}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: email.unread ? '600' : '500', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {email.subject}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {email.preview}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Folder Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>4 messages in Inbox</span>
              <span>Encrypted TLS 1.3</span>
            </div>
          </div>

          {/* Right Pane: Email Reading & Reply Box */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)', overflow: 'hidden' }}>
            
            {/* Action Bar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button title="Reply" style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500' }}>
                  <Reply size={14} /> Reply
                </button>
                <button title="Archive" style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500' }}>
                  <Archive size={14} /> Archive
                </button>
                <button title="Delete" style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-base)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', backgroundColor: 'rgba(51, 92, 255, 0.08)', color: 'var(--accent-primary)', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
                  {selectedEmail.tag}
                </span>
              </div>
            </div>

            {/* Message Body Content */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <h2 className="display-font" style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>
                {selectedEmail.subject}
              </h2>

              {/* Sender Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: selectedEmail.avatarColor, color: '#fff', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedEmail.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{selectedEmail.sender}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>&lt;{selectedEmail.senderEmail}&gt;</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedEmail.title} • To: You &lt;alice.smith@acmecorp.internal&gt;</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedEmail.timestamp} (Today)
                </div>
              </div>

              {/* Paragraphs */}
              <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedEmail.body.map((p, idx) => (
                  <p key={idx} style={{ margin: 0 }}>{p}</p>
                ))}
              </div>

              {/* Reply Box Section */}
              <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Reply size={15} color="var(--accent-primary)" />
                      Reply to {selectedEmail.sender}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Typing here streams live biometrics
                    </span>
                  </div>

                  <form onSubmit={handleSendReply}>
                    <textarea
                      className="input-field"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Draft your reply to ${selectedEmail.sender}... (e.g. Thanks, I have reviewed the requirements and will verify the deployment.)`}
                      style={{ minHeight: '90px', width: '100%', resize: 'vertical', fontSize: '13px', marginBottom: '12px', lineHeight: '1.5' }}
                      required
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <Paperclip size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {replySentSuccess && (
                          <span style={{ color: 'var(--accent-trust)', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Reply Sent Successfully
                          </span>
                        )}
                        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}>
                          <Send size={14} /> Send Reply
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* KANBAN BOARD VIEW */}
      {activeView === 'kanban' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', overflowY: 'auto', minHeight: 0 }}>
          
          {[
            { key: 'todo', title: 'To Do', color: 'var(--text-secondary)' },
            { key: 'in_progress', title: 'In Progress', color: 'var(--accent-primary)' },
            { key: 'done', title: 'Done', color: 'var(--accent-trust)' },
          ].map((col) => {
            const tasks = kanbanTasks[col.key] || [];

            return (
              <div key={col.key} style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)' }}>
                
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }}></span>
                    <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{col.title}</span>
                    <span style={{ backgroundColor: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      {tasks.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAddingToColumn(addingToColumn === col.key ? null : col.key)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--text-secondary)' }}
                    title="Add task"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Add Task Input */}
                {addingToColumn === col.key && (
                  <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="text"
                      className="input-field"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task description..."
                      style={{ fontSize: '13px', marginBottom: '8px' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => { setAddingToColumn(null); setNewTaskTitle(''); }}
                        style={{ padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddTask(col.key)}
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Task Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="card"
                      style={{ padding: '14px', cursor: 'grab', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', backgroundColor: `${task.tagColor}15`, color: task.tagColor, padding: '2px 6px', borderRadius: '4px' }}>
                          {task.tag}
                        </span>
                        <span style={{ fontSize: '11px', color: task.priority === 'High' ? 'var(--accent-danger)' : 'var(--text-secondary)', fontWeight: task.priority === 'High' ? '600' : 'normal' }}>
                          {task.priority} Priority
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: '1.4' }}>
                        {task.title}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#fff', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {task.assigneeInitials}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{task.assignee}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <Clock size={12} />
                          <span>{task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}
