import 'server-only';
import type { PrivateSimulationQuestion } from './simulation.types';
import type { PrivateQuestion, Quiz } from './types';

/**
 * The question bank for quiz version 2026.1: 10 interactive scenarios + 30 choice questions.
 * Each attempt draws 15 of them (see `draw` at the bottom and draw.ts).
 *
 * Interactive simulation questions first.
 * Structure and scoring rules are documented in simulation.types.ts.
 *
 * Every person, company, domain and card number below is made up.
 * Never put real customer data in quiz content.
 */

/** Join paragraphs with a blank line, so bodies stay readable here and in the UI. */
const p = (...paragraphs: string[]) => paragraphs.join('\n\n');

export const SIMULATION_QUESTIONS: PrivateSimulationQuestion[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Fake supplier invoice with a disguised executable
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-phish-01',
    topic: 'phishing',
    type: 'simulation',
    title: 'The overdue invoice',
    brief: 'Tap anything in this email that looks suspicious, then decide what to do.',
    start: 'inbox',
    steps: [
      {
        id: 'inbox',
        narration: 'Monday morning. This is sitting at the top of your inbox.',
        screen: {
          kind: 'email',
          from: { name: 'Harbourview Hotels Accounts', address: 'accounts@harbourview-hotels.co' },
          to: 'Me',
          subject: 'OVERDUE: Invoice 8812, final notice before suspension',
          receivedAt: 'Today, 9:42 am',
          body: p(
            'Hi,',
            'Our records show invoice 8812 for your group booking is now 14 days overdue. If payment is not received today your allocation will be released.',
            'Please open the attached invoice and confirm payment by 3 pm.',
            'Regards,\nAccounts Team\nHarbourview Hotels',
          ),
          attachments: ['Invoice_8812.pdf.exe'],
        },
        hotspots: [
          { id: 'h-domain', target: 'from', match: 'harbourview-hotels.co' },
          { id: 'h-subject', target: 'subject', match: 'final notice before suspension' },
          { id: 'h-deadline', target: 'body', match: 'confirm payment by 3 pm' },
          { id: 'h-attachment', target: 'attachment', index: 0 },
          { id: 'h-signoff', target: 'body', match: 'Accounts Team' },
        ],
        actions: [
          { id: 'open-attachment', kind: 'open_attachment', label: 'Open the invoice', next: 'opened' },
          { id: 'reply-resend', kind: 'reply', label: 'Reply and ask them to resend it as a normal PDF' },
          { id: 'forward-accounts', kind: 'forward', label: 'Forward it to Accounts to pay before 3 pm' },
          { id: 'call-hotel', kind: 'call_known_number', label: 'Call the hotel on the number in your supplier list', next: 'hotel-call' },
          { id: 'report', kind: 'report', label: 'Click "Report phishing"' },
        ],
      },
      {
        id: 'opened',
        narration: 'You double-click the file. A window flashes up and disappears. Nothing else seems to happen.',
        actions: [
          { id: 'carry-on', kind: 'ignore', label: 'Carry on working. Nothing happened' },
          { id: 'report-after-open', kind: 'call_known_number', label: 'Disconnect from Wi-Fi and call IT on 1300 318 227 now' },
        ],
      },
      {
        id: 'hotel-call',
        screen: {
          kind: 'call',
          app: 'Phone call',
          messages: [
            { sender: 'Me', text: 'Hi, I got an overdue notice for invoice 8812. Can you check it for me?', isMe: true },
            { sender: 'Harbourview Reception', text: 'I’ve checked with accounts. We have no invoice 8812 and your account is fully paid. We don’t send invoices as attachments like that either.' },
          ],
        },
        actions: [
          { id: 'delete-only', kind: 'delete', label: 'Delete the email. Problem solved' },
          { id: 'report-after-call', kind: 'report', label: 'Report the email to IT with "Report phishing"' },
        ],
      },
    ],
    actionResults: {
      'open-attachment': { verdict: 'unsafe', feedback: 'The file ends in ".exe". It’s a program, not a PDF. Opening it could install malware.' },
      'reply-resend': { verdict: 'unsafe', feedback: 'Replying tells the attacker your address is active and invites a second attempt.' },
      'forward-accounts': { verdict: 'unsafe', feedback: 'Forwarding spreads the attack and could lead to a fraudulent payment.' },
      'call-hotel': { verdict: 'ok', feedback: 'Good. You checked using contact details you already had, not ones in the email.' },
      'report': { verdict: 'best', feedback: 'Reporting lets IT block it for everyone. If you’re unsure about the real invoice, call the supplier on a number you already have.' },
      'carry-on': { verdict: 'unsafe', feedback: 'Malware often runs silently. "Nothing happened" is exactly what it wants you to think.' },
      'report-after-open': { verdict: 'best', feedback: 'Right move now. Disconnecting limits the damage, and IT needs to know within the hour.' },
      'delete-only': { verdict: 'ok', feedback: 'You’re safe, but other staff may have received it too. Report it so IT can protect them.' },
      'report-after-call': { verdict: 'best', feedback: 'Verified and reported. That’s the ideal outcome.' },
    },
    hotspotResults: {
      'h-domain': { isFlag: true, explanation: 'The hotel uses ".com.au". ".co" is a lookalike domain.' },
      'h-subject': { isFlag: true, explanation: 'Threats and "final notice" language are there to rush you.' },
      'h-deadline': { isFlag: true, explanation: 'A tight same-day deadline is a pressure tactic.' },
      'h-attachment': { isFlag: true, explanation: '".pdf.exe" is a program disguised as a PDF.' },
      'h-signoff': { isFlag: false, explanation: 'A generic sign-off is normal for accounts teams. It’s not a warning sign on its own.' },
    },
    minFlags: 2,
    explanation:
      'Lookalike domain, urgent threats and a disguised ".exe" attachment. Don’t open, reply or forward. Report it, and check with the supplier using details you already have.',
    policyRef: 'IT & Security Policy v2.0, s.11; Staff Cybersecurity Checklist #3',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Supplier bank-detail change (payment redirection fraud)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-phish-02',
    topic: 'phishing',
    type: 'simulation',
    title: 'New bank details',
    brief: 'Read it carefully. Tap anything that looks suspicious, then choose what to do.',
    start: 'inbox',
    steps: [
      {
        id: 'inbox',
        narration: 'It’s Thursday afternoon. Friday is supplier payment day.',
        screen: {
          kind: 'email',
          from: { name: 'Mia Torres, Coastline Coaches', address: 'mia.torres@coastlinecoaches.com.au' },
          replyTo: 'coastline.payments@mailbox-secure.net',
          to: 'Me',
          subject: 'Updated bank details for this week’s payment',
          receivedAt: 'Today, 4:51 pm',
          body: p(
            'Hi there,',
            'Just a quick one. We’ve moved banks and our old account is now closed. Please update our details before Friday’s payment run so there are no delays:',
            'BSB: 062-000\nAccount: 1234 5678\nName: Coastline Transport Services',
            'Please don’t call the office about this, the phones are being changed over this week. Just reply here once it’s done.',
            'Thanks so much,\nMia',
          ),
        },
        hotspots: [
          { id: 'h-bank-change', target: 'body', match: 'Please update our details before Friday’s payment run' },
          { id: 'h-reply-to', target: 'replyTo' },
          { id: 'h-dont-call', target: 'body', match: 'Please don’t call the office about this' },
          { id: 'h-sender', target: 'from', match: 'Mia Torres, Coastline Coaches' },
          { id: 'h-account-name', target: 'body', match: 'Name: Coastline Transport Services' },
          { id: 'h-signoff', target: 'body', match: 'Thanks so much' },
        ],
        actions: [
          { id: 'update-details', kind: 'other', label: 'Update the bank details in the payment system' },
          { id: 'reply-confirm', kind: 'reply', label: 'Reply asking Mia to confirm the change' },
          { id: 'call-known', kind: 'call_known_number', label: 'Call Coastline on the number in your supplier records', next: 'supplier-call' },
          { id: 'report', kind: 'report', label: 'Click "Report phishing" and don’t change anything' },
        ],
      },
      {
        id: 'supplier-call',
        screen: {
          kind: 'call',
          app: 'Phone call',
          messages: [
            { sender: 'Me', text: 'Hi Mia, just checking your email about new bank details?', isMe: true },
            { sender: 'Mia (Coastline Coaches)', text: 'What email? We haven’t changed banks! Someone must have got into my mailbox. Please don’t pay that account.' },
          ],
        },
        actions: [
          { id: 'fix-and-move-on', kind: 'delete', label: 'Delete the email. Mia knows now, so nothing else to do' },
          { id: 'report-after-call', kind: 'report', label: 'Report it to IT and let Accounts know straight away' },
        ],
      },
    ],
    actionResults: {
      'update-details': { verdict: 'unsafe', feedback: 'Friday’s payment would go straight to the criminal. Bank changes must always be confirmed by phone.' },
      'reply-confirm': { verdict: 'unsafe', feedback: 'The reply goes to the attacker’s address, and they will happily "confirm" it.' },
      'call-known': { verdict: 'ok', feedback: 'Exactly right. You verified on a number you already had.' },
      'report': { verdict: 'best', feedback: 'Good. IT can investigate, and the details stay unchanged until someone verifies them by phone.' },
      'fix-and-move-on': { verdict: 'unsafe', feedback: 'A supplier’s hacked mailbox is a live incident. Other staff may have received the same email. It must be reported within the hour.' },
      'report-after-call': { verdict: 'best', feedback: 'Verified, reported, and Accounts warned. The fraud is stopped.' },
    },
    hotspotResults: {
      'h-bank-change': { isFlag: true, explanation: 'A request to change bank details by email is the main sign of payment fraud.' },
      'h-reply-to': { isFlag: true, explanation: 'Replies go to a different domain from the sender’s.' },
      'h-dont-call': { isFlag: true, explanation: 'Being told not to phone is designed to stop you verifying.' },
      'h-sender': { isFlag: false, explanation: 'A familiar name proves nothing, because real mailboxes get hacked. It isn’t a warning sign either.' },
      'h-account-name': { isFlag: false, explanation: 'A slightly different account name can be legitimate. You can’t judge it from the email alone.' },
      'h-signoff': { isFlag: false, explanation: 'A friendly sign-off is normal.' },
    },
    minFlags: 3,
    explanation:
      'Bank-detail changes by email, a mismatched reply-to and "don’t call" are classic payment fraud. Always confirm changes by phone using a number you already have.',
    policyRef: 'IT & Security Policy v2.0, s.11',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. "Password expires today" credential phishing, with a fake sign-in page
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-mfa-01',
    topic: 'passwords_mfa',
    type: 'simulation',
    title: 'Password expiring',
    brief: 'Hover over or tap anything suspicious, then decide what to do.',
    start: 'inbox',
    steps: [
      {
        id: 'inbox',
        screen: {
          kind: 'email',
          from: { name: 'Google Workspace', address: 'no-reply@workspace-alerts.info' },
          to: 'Me',
          subject: 'Action required: your password expires today',
          receivedAt: 'Today, 7:15 am',
          body: p(
            'Your Complex Travel Group password will expire in 2 hours.',
            'To keep your current password and avoid losing access to Gmail and Drive, confirm your account below.',
            'Google Workspace Team',
          ),
          links: [{ text: 'Keep my current password', href: 'http://g00gle-workspace-login.com/ctg/verify' }],
        },
        hotspots: [
          { id: 'h-sender', target: 'from', match: 'workspace-alerts.info' },
          { id: 'h-link', target: 'link', index: 0 },
          { id: 'h-urgency', target: 'body', match: 'will expire in 2 hours' },
          { id: 'h-company', target: 'body', match: 'Complex Travel Group' },
        ],
        actions: [
          { id: 'click-link', kind: 'click_link', label: 'Click "Keep my current password"', next: 'fake-login' },
          { id: 'forward-team', kind: 'forward', label: 'Forward it to the team to warn them' },
          { id: 'delete', kind: 'delete', label: 'Delete it' },
          { id: 'report', kind: 'report', label: 'Click "Report phishing"' },
        ],
      },
      {
        id: 'fake-login',
        narration: 'A sign-in page opens in your browser.',
        screen: {
          kind: 'webpage',
          url: 'http://g00gle-workspace-login.com/ctg/verify',
          title: 'Sign in: Google Workspace',
          body: 'Confirm your password to keep access to your account.',
          fields: ['Email', 'Password'],
        },
        hotspots: [{ id: 'h-url', target: 'url' }],
        actions: [
          { id: 'enter-password', kind: 'enter_details', label: 'Enter your email and password', next: 'after-entry' },
          { id: 'close-and-report', kind: 'close', label: 'Close the page and report the email to IT' },
        ],
      },
      {
        id: 'after-entry',
        narration: 'The page says "Thanks, you’re verified!" A minute later your phone shows an MFA prompt you didn’t start.',
        actions: [
          { id: 'approve-prompt', kind: 'other', label: 'Approve the prompt. It must be part of the verification' },
          { id: 'deny-and-call', kind: 'call_known_number', label: 'Deny it and call IT on 1300 318 227 straight away' },
        ],
      },
    ],
    actionResults: {
      'click-link': { verdict: 'unsafe', feedback: 'The link goes to "g00gle" (with zeros), not Google. Even opening phishing pages is risky.' },
      'forward-team': { verdict: 'unsafe', feedback: 'Forwarding spreads the link. Report it and IT will warn people safely.' },
      'delete': { verdict: 'ok', feedback: 'You’re safe, but reporting it lets IT block it for everyone.' },
      'report': { verdict: 'best', feedback: 'Spotted and reported. IT can now block it company-wide.' },
      'enter-password': { verdict: 'unsafe', feedback: 'The attacker now has your password.' },
      'close-and-report': { verdict: 'best', feedback: 'Good recovery. Clicking was risky, but closing it and reporting is the right move.' },
      'approve-prompt': { verdict: 'unsafe', feedback: 'You just let the attacker into your account.' },
      'deny-and-call': { verdict: 'best', feedback: 'Right. Denying blocks them for now, and IT can reset your password before they try again.' },
    },
    hotspotResults: {
      'h-sender': { isFlag: true, explanation: 'Google doesn’t send from "workspace-alerts.info".' },
      'h-link': { isFlag: true, explanation: 'The real address is "g00gle-workspace-login.com", a lookalike using zeros.' },
      'h-urgency': { isFlag: true, explanation: 'A 2-hour deadline is a pressure tactic.' },
      'h-company': { isFlag: false, explanation: 'Your company name is public, so it proves nothing either way.' },
      'h-url': { isFlag: true, explanation: 'Not a Google address, and "http" with no padlock.' },
    },
    minFlags: 2,
    explanation:
      'Check where links really go before clicking. Never enter your password on a page you reached from an email. If you did, deny any MFA prompts and call IT immediately.',
    policyRef: 'IT & Security Policy v2.0, s.7.1, s.7.2, s.11',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Parcel-delivery SMS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-phish-03',
    topic: 'phishing',
    type: 'simulation',
    title: 'Parcel on hold',
    brief: 'You are expecting a few deliveries this week. Tap anything that looks suspicious, then choose what to do.',
    start: 'sms',
    steps: [
      {
        id: 'sms',
        screen: {
          kind: 'sms',
          from: '+61 4XX XXX 193',
          receivedAt: 'Today, 11:03 am',
          messages: [
            'DLVR: Your parcel is being held at our depot due to an unpaid customs fee of $2.95. Pay within 24 hrs or it will be returned to sender:',
          ],
          links: [{ text: 'dlvr-au-parcels.top/pay', href: 'https://dlvr-au-parcels.top/pay' }],
        },
        hotspots: [
          { id: 'h-number', target: 'from' },
          { id: 'h-fee', target: 'message', index: 0, match: 'unpaid customs fee of $2.95' },
          { id: 'h-deadline', target: 'message', index: 0, match: 'Pay within 24 hrs' },
          { id: 'h-link', target: 'link', index: 0 },
          { id: 'h-held', target: 'message', index: 0, match: 'Your parcel is being held at our depot' },
        ],
        actions: [
          { id: 'tap-link', kind: 'click_link', label: 'Tap the link to see which parcel it is', next: 'pay-page' },
          { id: 'reply-stop', kind: 'reply', label: 'Reply STOP' },
          { id: 'delete-check', kind: 'delete', label: 'Delete it, and check deliveries in the courier’s official app' },
        ],
      },
      {
        id: 'pay-page',
        screen: {
          kind: 'webpage',
          url: 'https://dlvr-au-parcels.top/pay',
          title: 'DLVR: Pay customs fee',
          body: 'Your parcel AU-88213 is awaiting a customs fee of $2.95. Pay now to schedule redelivery.',
          fields: ['Full name', 'Card number', 'Expiry', 'CVV'],
        },
        hotspots: [{ id: 'h-url', target: 'url' }],
        actions: [
          { id: 'pay', kind: 'enter_details', label: 'Pay the $2.95' },
          { id: 'close', kind: 'close', label: 'Close the page and delete the text' },
        ],
      },
    ],
    actionResults: {
      'tap-link': { verdict: 'unsafe', feedback: 'Tapping scam links on a work phone risks your device and data.' },
      'reply-stop': { verdict: 'unsafe', feedback: 'Any reply tells scammers your number is active, and you’ll get more texts.' },
      'delete-check': { verdict: 'best', feedback: 'Right. Check real deliveries yourself through official channels.' },
      'pay': { verdict: 'unsafe', feedback: 'The $2.95 is bait. They now have your full card details.' },
      'close': { verdict: 'best', feedback: 'Good recovery. Don’t tap links like that next time.' },
    },
    hotspotResults: {
      'h-number': { isFlag: true, explanation: 'Real couriers don’t text from random mobile numbers.' },
      'h-fee': { isFlag: true, explanation: 'Small "customs fees" are the classic bait for stealing card details.' },
      'h-deadline': { isFlag: true, explanation: 'A deadline is there to rush you.' },
      'h-link': { isFlag: true, explanation: '".top" is not a real courier domain.' },
      'h-held': { isFlag: false, explanation: 'Parcels really do get held, so this isn’t a giveaway on its own.' },
      'h-url': { isFlag: true, explanation: 'Same fake domain. Never enter card details here.' },
    },
    minFlags: 2,
    explanation:
      'Delivery-fee texts are one of the most common scams. Don’t tap, reply or pay. Check deliveries in the courier’s official app or website.',
    policyRef: 'IT & Security Policy v2.0, s.11',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Impersonated executive asking for gift cards
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-phish-04',
    topic: 'phishing',
    type: 'simulation',
    title: 'A favour for the boss',
    brief: 'Tap anything that looks suspicious, then decide how to respond.',
    start: 'chat',
    steps: [
      {
        id: 'chat',
        screen: {
          kind: 'chat',
          app: 'WhatsApp',
          messages: [
            { sender: '+61 4XX XXX 772 ~David Lim (Managing Director)', time: '2:12 pm', text: 'Hi, are you at your desk? I need a quick favour, it’s confidential.' },
            { sender: 'Me', time: '2:13 pm', text: 'Hi David, yes, what do you need?', isMe: true },
            { sender: '+61 4XX XXX 772 ~David Lim (Managing Director)', time: '2:13 pm', text: 'I’m in back-to-back meetings. I need 5 x $200 Apple gift cards for a client thank-you. Can you buy them now and send me photos of the codes? I’ll pay you back today. Please keep it between us for now.' },
          ],
        },
        hotspots: [
          { id: 'h-number', target: 'sender', index: 0 },
          { id: 'h-confidential', target: 'message', index: 0, match: 'it’s confidential' },
          { id: 'h-gift-cards', target: 'message', index: 2, match: '5 x $200 Apple gift cards' },
          { id: 'h-codes', target: 'message', index: 2, match: 'send me photos of the codes' },
          { id: 'h-secret', target: 'message', index: 2, match: 'Please keep it between us for now' },
          { id: 'h-client', target: 'message', index: 2, match: 'for a client thank-you' },
        ],
        actions: [
          { id: 'buy-cards', kind: 'other', label: 'Buy the cards. The MD asked and it’s urgent' },
          { id: 'test-in-chat', kind: 'reply', label: 'Ask a personal question in the chat to check it’s him', next: 'chat-check' },
          { id: 'call-david', kind: 'call_known_number', label: 'Stop replying, call David on his known number, and report it to IT' },
        ],
      },
      {
        id: 'chat-check',
        screen: {
          kind: 'chat',
          app: 'WhatsApp',
          messages: [
            { sender: 'Me', time: '2:15 pm', text: 'Sure. Just checking, where was our team conference this year?', isMe: true },
            { sender: '+61 4XX XXX 772 ~David Lim (Managing Director)', time: '2:15 pm', text: 'Fiji of course 😄 Now please hurry, the client is waiting.' },
          ],
        },
        actions: [
          { id: 'buy-after-check', kind: 'other', label: 'He got it right. Buy the cards' },
          { id: 'call-after-check', kind: 'call_known_number', label: 'Still call David on his known number and report it to IT' },
        ],
      },
    ],
    actionResults: {
      'buy-cards': { verdict: 'unsafe', feedback: 'Gift card codes are untraceable cash. That money is gone.' },
      'test-in-chat': { verdict: 'ok', feedback: 'Checking is good instinct, but a test inside the same chat proves little. Answers are often on social media.' },
      'call-david': { verdict: 'best', feedback: 'Right. Verify through a separate channel you trust, and report it so others are warned.' },
      'buy-after-check': { verdict: 'unsafe', feedback: 'The conference location was on LinkedIn. Verify outside the chat, every time.' },
      'call-after-check': { verdict: 'best', feedback: 'Good. A separate channel is the only real check. The real David knows nothing about it.' },
    },
    hotspotResults: {
      'h-number': { isFlag: true, explanation: 'An unknown number. Anyone can set a WhatsApp name and photo.' },
      'h-confidential': { isFlag: true, explanation: '"Confidential" is used to stop you checking with others.' },
      'h-gift-cards': { isFlag: true, explanation: 'Gift cards are the scammer’s favourite payment, because they’re untraceable.' },
      'h-codes': { isFlag: true, explanation: 'Asking for photos of the codes means they can spend them instantly.' },
      'h-secret': { isFlag: true, explanation: 'Secrecy is a classic manipulation tactic.' },
      'h-client': { isFlag: false, explanation: 'Client gifts are normal. The reason itself isn’t the warning sign.' },
    },
    minFlags: 3,
    explanation:
      'Urgency, secrecy and gift cards mean impersonation. Verify through a separate channel you already trust, never inside the same chat, and report it.',
    policyRef: 'IT & Security Policy v2.0, s.11; Policy p.1 (report within 1 hour)',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Vishing: fake IT support asking for an MFA code
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-mfa-02',
    topic: 'passwords_mfa',
    type: 'simulation',
    title: 'IT on the line',
    brief: 'You answer a call from a number you don’t recognise. Tap anything that sounds suspicious, then decide.',
    start: 'call',
    steps: [
      {
        id: 'call',
        screen: {
          kind: 'call',
          app: 'Phone call',
          messages: [
            { sender: 'Caller', text: 'Hi, it’s Jordan from IT support. We’ve picked up some suspicious sign-ins on your account and need to secure it right away.' },
            { sender: 'Me', text: 'Oh, okay. What do you need me to do?', isMe: true },
            { sender: 'Caller', text: 'I’m sending a verification code to your phone now. Just read it back to me so I can confirm it’s you and lock the attacker out. Quickly, please, they may still be in.' },
          ],
        },
        hotspots: [
          { id: 'h-claims-it', target: 'message', index: 0, match: 'Jordan from IT support' },
          { id: 'h-sign-ins', target: 'message', index: 0, match: 'suspicious sign-ins on your account' },
          { id: 'h-read-code', target: 'message', index: 2, match: 'read it back to me' },
          { id: 'h-hurry', target: 'message', index: 2, match: 'Quickly, please, they may still be in' },
        ],
        actions: [
          { id: 'read-code', kind: 'other', label: 'Read out the code', next: 'after-code' },
          { id: 'ask-id', kind: 'reply', label: 'Ask for their staff ID first', next: 'staff-id' },
          { id: 'hang-up', kind: 'call_known_number', label: 'Hang up and call IT yourself on 1300 318 227' },
        ],
      },
      {
        id: 'staff-id',
        screen: {
          kind: 'call',
          app: 'Phone call',
          messages: [
            { sender: 'Caller', text: 'Sure, it’s IT-4471. You can check it later. Now, the code please, quickly.' },
          ],
        },
        actions: [
          { id: 'read-code-after-id', kind: 'other', label: 'Read out the code', next: 'after-code' },
          { id: 'hang-up-after-id', kind: 'call_known_number', label: 'Hang up and call IT yourself on 1300 318 227' },
        ],
      },
      {
        id: 'after-code',
        narration: '"Great, you’re all secured," says the caller, and hangs up. A minute later you get an email: "New sign-in to your account."',
        actions: [
          { id: 'carry-on', kind: 'ignore', label: 'That’ll be IT securing it. Carry on' },
          { id: 'report-now', kind: 'call_known_number', label: 'Call IT on 1300 318 227 straight away' },
        ],
      },
    ],
    actionResults: {
      'read-code': { verdict: 'unsafe', feedback: 'The code was the last thing they needed. They’re now in your account.' },
      'ask-id': { verdict: 'ok', feedback: 'Questioning them is good, but staff IDs are easy to make up.' },
      'hang-up': { verdict: 'best', feedback: 'Exactly right. IT will never ask for your code. Call back on the number you know.' },
      'read-code-after-id': { verdict: 'unsafe', feedback: 'A made-up ID proves nothing. They’re now in your account.' },
      'hang-up-after-id': { verdict: 'best', feedback: 'Right. Verify by calling IT yourself.' },
      'carry-on': { verdict: 'unsafe', feedback: 'That sign-in was the attacker. Every minute counts.' },
      'report-now': { verdict: 'best', feedback: 'Good recovery. IT can lock the account and reset your password fast.' },
    },
    hotspotResults: {
      'h-claims-it': { isFlag: true, explanation: 'An unknown number claiming to be IT. You can’t verify who’s calling.' },
      'h-sign-ins': { isFlag: false, explanation: 'IT really might call about sign-ins. The topic itself isn’t the giveaway.' },
      'h-read-code': { isFlag: true, explanation: 'IT will never ask for your MFA code or password.' },
      'h-hurry': { isFlag: true, explanation: 'Panic and urgency stop you thinking it through.' },
    },
    minFlags: 2,
    explanation:
      'Nobody legitimate will ever ask for your MFA code. Hang up and call IT on 1300 318 227. If you’ve already shared a code, report it immediately.',
    policyRef: 'IT & Security Policy v2.0, s.7.2; Policy p.1',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Customer emails a full card number
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-pay-01',
    topic: 'payment_data',
    type: 'simulation',
    title: 'Card details by email',
    brief: 'This is a real customer, not a scam. Tap anything that shouldn’t be here, then handle it.',
    start: 'inbox',
    steps: [
      {
        id: 'inbox',
        screen: {
          kind: 'email',
          from: { name: 'Sam Ellery', address: 'sam.ellery@example-mail.com' },
          to: 'Me',
          subject: 'Re: Deposit for Bali trip',
          receivedAt: 'Yesterday, 6:20 pm',
          body: p(
            'Hi,',
            'Here are my card details for the deposit so we can lock it in:',
            'Card: 4111 1111 1111 1111\nExpiry: 08/28\nCVV: 123',
            'Thanks!\nSam',
          ),
        },
        hotspots: [
          { id: 'h-card', target: 'body', match: 'Card: 4111 1111 1111 1111' },
          { id: 'h-cvv', target: 'body', match: 'CVV: 123' },
          { id: 'h-sender', target: 'from' },
          { id: 'h-subject', target: 'subject' },
        ],
        actions: [
          { id: 'process', kind: 'other', label: 'Process the payment from the email and reply "Done, thanks"' },
          { id: 'reply-quoting', kind: 'reply', label: 'Reply with the details included to confirm the card' },
          { id: 'save-crm', kind: 'other', label: 'Copy the details into CRM notes for the final payment' },
          { id: 'delete-tell-it', kind: 'delete', label: 'Delete it (and from Deleted Items) and tell IT', next: 'reply' },
        ],
      },
      {
        id: 'reply',
        narration: 'Sam still needs to pay the deposit. How do you reply?',
        actions: [
          { id: 'send-approved', kind: 'reply', label: 'Send Sam the approved secure payment method, and ask them not to email card details' },
          { id: 'phone-write-down', kind: 'call_known_number', label: 'Call Sam and write the card number on a notepad' },
        ],
      },
    ],
    actionResults: {
      'process': { verdict: 'unsafe', feedback: 'The card details are still sitting in email, and now in your reply thread too.' },
      'reply-quoting': { verdict: 'unsafe', feedback: 'That creates another copy of the card number in two mailboxes.' },
      'save-crm': { verdict: 'unsafe', feedback: 'Card numbers must never be stored in notes, files or the CRM.' },
      'delete-tell-it': { verdict: 'ok', feedback: 'Right. Remove every copy and let IT know.' },
      'send-approved': { verdict: 'best', feedback: 'Perfect. The customer can pay safely, and knows for next time.' },
      'phone-write-down': { verdict: 'unsafe', feedback: 'Writing card numbers down is still storing them. Use the approved process.' },
    },
    hotspotResults: {
      'h-card': { isFlag: true, explanation: 'A full card number should never be in email.' },
      'h-cvv': { isFlag: true, explanation: 'The CVV must never be stored anywhere, ever.' },
      'h-sender': { isFlag: false, explanation: 'This is the real customer. The problem is what they sent, not who sent it.' },
      'h-subject': { isFlag: false, explanation: 'A normal reply to your booking thread.' },
    },
    minFlags: 1,
    explanation:
      'Never use, reply with, or store card details sent by email. Delete every copy, tell IT, and send the customer the approved payment method.',
    policyRef: 'Staff Cybersecurity Checklist #4; IT & Security Policy v2.0, s.5',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Colleague pasted passport data into an unapproved AI tool
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-ai-01',
    topic: 'ai_tools',
    type: 'simulation',
    title: 'The AI shortcut',
    brief: 'A colleague shares a time-saving tip. Tap anything that looks like a problem, then respond.',
    start: 'chat',
    steps: [
      {
        id: 'chat',
        screen: {
          kind: 'chat',
          app: 'Google Chat',
          messages: [
            { sender: 'Priya (Groups team)', time: '10:05 am', text: 'Hey! Quick hack for the school group: I copied all 32 passport numbers, names and dates of birth into a free AI website and it built the rooming list in seconds 🙌' },
            { sender: 'Priya (Groups team)', time: '10:06 am', text: 'You should do the same for your corporate group, saves heaps of time. Want the link?' },
          ],
        },
        hotspots: [
          { id: 'h-passports', target: 'message', index: 0, match: 'passport numbers, names and dates of birth' },
          { id: 'h-free-ai', target: 'message', index: 0, match: 'free AI website' },
          { id: 'h-rooming', target: 'message', index: 0, match: 'built the rooming list' },
          { id: 'h-saves-time', target: 'message', index: 1, match: 'saves heaps of time' },
        ],
        actions: [
          { id: 'ask-link', kind: 'reply', label: '"Great idea, send me the link!"' },
          { id: 'names-only', kind: 'reply', label: '"I’ll try it, but only with names and dates of birth"' },
          { id: 'delete-history', kind: 'reply', label: '"I’ll use it, then delete my history on the site"' },
          { id: 'decline-report', kind: 'report', label: '"We can’t put passport details in unapproved AI tools. Can you let IT know what was shared?"' },
        ],
      },
    ],
    actionResults: {
      'ask-link': { verdict: 'unsafe', feedback: 'That would put more Restricted customer data into a tool nobody has vetted.' },
      'names-only': { verdict: 'unsafe', feedback: 'Names with dates of birth are still personal information.' },
      'delete-history': { verdict: 'unsafe', feedback: 'Deleting your history doesn’t delete what the provider has already stored or used.' },
      'decline-report': { verdict: 'best', feedback: 'Right. Only approved AI tools, and customer data that has already been shared must be reported.' },
    },
    hotspotResults: {
      'h-passports': { isFlag: true, explanation: 'Passport details are Restricted data.' },
      'h-free-ai': { isFlag: true, explanation: 'Free, unapproved AI tools may store and reuse what you paste.' },
      'h-rooming': { isFlag: false, explanation: 'Making rooming lists is a fine task. The data used is the problem.' },
      'h-saves-time': { isFlag: false, explanation: 'Saving time is great, as long as you use approved tools.' },
    },
    minFlags: 2,
    explanation:
      'Never paste customer personal data into unapproved AI tools. Use approved tools only, and report it to IT if data has already been shared.',
    policyRef: 'IT & Security Policy v2.0, s.5, s.6.4',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. A legitimate email: not everything is phishing
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-phish-05',
    topic: 'phishing',
    type: 'simulation',
    title: 'Quote reply',
    brief: 'Yesterday you asked this resort for a quote for booking QT-55021. Tap anything that looks suspicious, then decide what to do.',
    start: 'inbox',
    steps: [
      {
        id: 'inbox',
        screen: {
          kind: 'email',
          from: { name: 'Reservations, Lagoon Bay Resort', address: 'reservations@lagoonbayresort.com.au' },
          to: 'Me',
          subject: 'Re: Quote request QT-55021, 4 nights, 2 adults',
          receivedAt: 'Today, 8:30 am',
          body: p(
            'Hi,',
            'Thanks for your enquiry. As requested, the rate for 12–16 March is $289 per night, room only, in an Ocean View King.',
            'The quote is valid for 7 days. To confirm, reply to this email or call us on the number in our directory listing. Payment is taken through your usual supplier portal.',
            'Kind regards,\nLagoon Bay Resort Reservations',
          ),
        },
        hotspots: [
          { id: 'h-sender', target: 'from' },
          { id: 'h-reference', target: 'subject', match: 'QT-55021' },
          { id: 'h-validity', target: 'body', match: 'The quote is valid for 7 days' },
          { id: 'h-payment', target: 'body', match: 'Payment is taken through your usual supplier portal' },
        ],
        actions: [
          { id: 'report', kind: 'report', label: 'Report it as phishing, just in case' },
          { id: 'forward-it', kind: 'forward', label: 'Forward it to IT and wait for approval' },
          { id: 'proceed', kind: 'reply', label: 'Carry on as normal and reply to confirm with the customer’s go-ahead' },
        ],
      },
    ],
    actionResults: {
      'report': { verdict: 'ok', feedback: 'Not harmful, but this one is genuine. Over-reporting slows down you and IT.' },
      'forward-it': { verdict: 'ok', feedback: 'Not harmful, but there’s nothing suspicious here. Trust the checks you made.' },
      'proceed': { verdict: 'best', feedback: 'Right. It’s expected, from the usual domain, matches your reference, and asks nothing unusual.' },
    },
    hotspotResults: {
      'h-sender': { isFlag: false, explanation: 'The supplier’s usual domain. A good sign.' },
      'h-reference': { isFlag: false, explanation: 'It matches the reference you sent. A good sign.' },
      'h-validity': { isFlag: false, explanation: 'A normal validity period, not a pressure deadline.' },
      'h-payment': { isFlag: false, explanation: 'Payment through the usual portal. No new bank details.' },
    },
    minFlags: 0,
    explanation:
      'Spotting phishing also means recognising normal mail. This email is expected, matches your reference, and comes from the usual domain with no links, attachments or payment changes. If any of that changes, stop and check.',
    policyRef: 'IT & Security Policy v2.0, s.11',
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Unrequested verification code, then a "send it back" text
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'sim-mfa-03',
    topic: 'passwords_mfa',
    type: 'simulation',
    title: 'Late-night code',
    brief: 'You weren’t signing in to anything. Tap anything that looks suspicious, then decide what to do.',
    start: 'sms',
    steps: [
      {
        id: 'sms',
        screen: {
          kind: 'sms',
          from: 'Google',
          receivedAt: 'Today, 9:58 pm',
          messages: [
            'G-482913 is your Google verification code.',
            'Google Support: A code was sent to you in error during a security check. Please reply with the 6-digit code to cancel the request and protect your account.',
          ],
        },
        hotspots: [
          { id: 'h-sender', target: 'from' },
          { id: 'h-unrequested', target: 'message', index: 0 },
          { id: 'h-reply-code', target: 'message', index: 1, match: 'Please reply with the 6-digit code' },
          { id: 'h-in-error', target: 'message', index: 1, match: 'sent to you in error' },
        ],
        actions: [
          { id: 'reply-code', kind: 'reply', label: 'Reply with the code to cancel the request', next: 'after-reply' },
          { id: 'ignore', kind: 'ignore', label: 'Ignore both. They don’t have the code, so nothing happened' },
          { id: 'wait', kind: 'ignore', label: 'Wait until morning and see if more texts come' },
          { id: 'report-now', kind: 'call_known_number', label: 'Don’t share it. Call IT on 1300 318 227 now' },
        ],
      },
      {
        id: 'after-reply',
        narration: 'Two minutes later you get an email: "New sign-in to your account from Windows, Lagos, Nigeria."',
        actions: [
          { id: 'report-after-reply', kind: 'call_known_number', label: 'Call IT on 1300 318 227 straight away' },
          { id: 'wait-after-reply', kind: 'ignore', label: 'Deal with it in the morning' },
        ],
      },
    ],
    actionResults: {
      'reply-code': { verdict: 'unsafe', feedback: 'The second text was the attacker. You just handed over the last piece they needed.' },
      'ignore': { verdict: 'unsafe', feedback: 'The code means someone already has your password. They’ll keep trying until it’s reset.' },
      'wait': { verdict: 'unsafe', feedback: 'Incidents must be reported within 1 hour, even at night.' },
      'report-now': { verdict: 'best', feedback: 'Right. IT can reset your password before the attacker gets in.' },
      'report-after-reply': { verdict: 'best', feedback: 'Good recovery. Fast reporting lets IT kick the attacker out.' },
      'wait-after-reply': { verdict: 'unsafe', feedback: 'The attacker has hours in your mailbox. Report it now.' },
    },
    hotspotResults: {
      'h-sender': { isFlag: false, explanation: 'Sender names on texts can be faked, so "Google" proves nothing either way.' },
      'h-unrequested': { isFlag: true, explanation: 'A code you didn’t request means someone is signing in with your password.' },
      'h-reply-code': { isFlag: true, explanation: 'Google never asks you to send a code back.' },
      'h-in-error': { isFlag: true, explanation: '"Sent in error" is a made-up excuse to get the code.' },
    },
    minFlags: 2,
    explanation:
      'An unexpected code means your password is compromised. Never share it, and report it to IT straight away, even after hours (1300 318 227).',
    policyRef: 'IT & Security Policy v2.0, s.7.2; Policy p.1 (report within 1 hour)',
  },
];



// ─────────────────────────────────────────────────────────────────────────────
// Choice questions (single / multi / true-false)
// ─────────────────────────────────────────────────────────────────────────────
//
// 30 questions across all 9 topics. Each attempt draws 10 of them, spread across topics (draw.ts),
// and shows the options in a shuffled order, so the letter of the right answer differs per person.
//
// policyRef is only set where the same policy section is already cited by a scenario above.
// ⚠ REVIEW before go-live: devices, networks and software have no policyRef because their policy
//   sections weren't confirmed. Add them if the IT & Security Policy covers these topics.

/** Options a, b, c, d… from labels, in the order written (they're shuffled per person on screen). */
const opts = (...labels: string[]) => labels.map((label, i) => ({ id: 'abcdefgh'[i], label }));

/** A true / false question. Option ids are 'true' and 'false'. */
const trueFalse = (q: Omit<PrivateQuestion, 'type' | 'options' | 'correct'> & { answer: boolean }): PrivateQuestion => {
  const { answer, ...rest } = q;
  return {
    ...rest,
    type: 'truefalse',
    options: [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }],
    correct: [answer ? 'true' : 'false'],
  };
};

export const CHOICE_QUESTIONS: PrivateQuestion[] = [
  // ── Phishing & scams ──────────────────────────────────────────────────────
  {
    id: 'q-phish-01',
    topic: 'phishing',
    type: 'multi',
    prompt: 'Which of these are warning signs in an email?',
    options: opts(
      'The sender’s address doesn’t match the company’s real domain',
      'It pressures you to act within a few hours',
      'It asks you to sign in through a link to "fix" your account',
      'It greets you by your first name',
    ),
    correct: ['a', 'b', 'c'],
    explanation:
      'Lookalike addresses, urgency and "sign in to fix your account" links are classic phishing signs. Using your first name proves nothing: attackers can find it easily.',
    policyRef: 'IT & Security Policy v2.0, s.11',
  },
  {
    id: 'q-phish-02',
    topic: 'phishing',
    type: 'single',
    prompt: 'You typed your Google password into a page from an email, then realised it was fake. What should you do first?',
    options: opts(
      'Close the tab and carry on: nothing seems to have happened',
      'Change your password straight away and call IT on 1300 318 227',
      'Wait a day and see if anything odd happens in your account',
      'Forward the email to your team so they know about it',
    ),
    correct: ['b'],
    explanation:
      'The attacker may already have your password. Change it and tell IT immediately (within the hour) so they can secure your account. Use "Report phishing" rather than forwarding the email around.',
    policyRef: 'IT & Security Policy v2.0, s.7.2, s.11; Policy p.1 (report within 1 hour)',
  },
  trueFalse({
    id: 'q-phish-03',
    topic: 'phishing',
    prompt: 'If an email shows the name of someone you know, it’s safe to open its attachment.',
    answer: false,
    explanation:
      'Display names are easy to fake, and real mailboxes get hacked. If an attachment is unexpected, check with the sender using contact details you already have.',
    policyRef: 'IT & Security Policy v2.0, s.11',
  }),

  // ── Passwords & MFA ───────────────────────────────────────────────────────
  {
    id: 'q-pass-01',
    topic: 'passwords_mfa',
    type: 'single',
    prompt: 'Which is the strongest approach to a work password?',
    options: opts(
      'A long passphrase of several random words, used only for this account',
      'Your pet’s name followed by the current year',
      'One strong password that you reuse for every account',
      'A short password with symbols, like P@ss1!',
    ),
    correct: ['a'],
    explanation:
      'Length beats complexity, and a password used in only one place can’t be reused by an attacker after another site is breached.',
    policyRef: 'IT & Security Policy v2.0, s.7.1',
  },
  {
    id: 'q-pass-02',
    topic: 'passwords_mfa',
    type: 'single',
    prompt: 'A colleague is locked out and asks to borrow your login for the afternoon. What do you do?',
    options: opts(
      'Share it, then change your password tomorrow',
      'Say no, and suggest they contact IT to unlock their account',
      'Log in for them and leave them at your desk',
      'Write it on a sticky note so they can return it later',
    ),
    correct: ['b'],
    explanation:
      'Your login is yours alone: anything done with it is recorded as you. IT can unlock your colleague’s own account.',
    policyRef: 'IT & Security Policy v2.0, s.7.1',
  },
  trueFalse({
    id: 'q-pass-03',
    topic: 'passwords_mfa',
    prompt: 'IT may ask you to read out an MFA code over the phone to verify who you are.',
    answer: false,
    explanation:
      'Nobody genuine will ever ask for your MFA code. Anyone who does is trying to get into your account. Hang up and report it.',
    policyRef: 'IT & Security Policy v2.0, s.7.2',
  }),
  {
    id: 'q-pass-04',
    topic: 'passwords_mfa',
    type: 'multi',
    prompt: 'Which of these are safe MFA habits?',
    options: opts(
      'Deny any MFA prompt you didn’t start, and tell IT',
      'Approve a prompt just to make repeated prompts stop',
      'Keep MFA turned on for your work account',
      'Share a code with your manager if they ask for it',
    ),
    correct: ['a', 'c'],
    explanation:
      'A prompt you didn’t start means someone has your password: deny it and report it. Approving to "make it stop" lets them in, and codes are never shared, even with your manager.',
    policyRef: 'IT & Security Policy v2.0, s.7.2',
  },

  // ── Handling customer data ────────────────────────────────────────────────
  {
    id: 'q-data-01',
    topic: 'data_classifications',
    type: 'single',
    prompt: 'A customer emails a photo of their passport for a booking. How should you handle it?',
    options: opts(
      'Save a copy to your desktop so it’s easy to find',
      'Use it only for the booking, keep it only where the booking process says, and delete other copies',
      'Forward it to your personal email so you can work on it at home',
      'Print it and pin it up until the booking is finished',
    ),
    correct: ['b'],
    explanation:
      'Passport details are Restricted data. Every extra copy (desktop, personal email, paper) is another place it can leak from.',
    policyRef: 'IT & Security Policy v2.0, s.5',
  },
  trueFalse({
    id: 'q-data-02',
    topic: 'data_classifications',
    prompt: 'Customers’ passport details are Restricted data.',
    answer: true,
    explanation: 'Passport details are Restricted: share them only when needed for the booking, and only through approved channels.',
    policyRef: 'IT & Security Policy v2.0, s.5',
  }),
  {
    id: 'q-data-03',
    topic: 'data_classifications',
    type: 'single',
    prompt: 'You need to share a rooming list (names and dates of birth) with a hotel through Google Drive. Which sharing setting is safest?',
    options: opts(
      '"Anyone with the link can view"',
      'Share it only with the hotel contact’s email address',
      'Make the file public so the hotel can find it easily',
      'Paste the list into a public online notes page and send the link',
    ),
    correct: ['b'],
    explanation:
      '"Anyone with the link" and public files can be opened by whoever the link reaches. Sharing with a named person keeps control of who sees personal data.',
    policyRef: 'IT & Security Policy v2.0, s.5',
  },
  {
    id: 'q-data-04',
    topic: 'data_classifications',
    type: 'multi',
    prompt: 'Which of these are personal information that must be protected?',
    options: opts('A customer’s date of birth', 'A customer’s passport number', 'A customer’s home address', 'The name of a hotel chain you often book'),
    correct: ['a', 'b', 'c'],
    explanation: 'Anything that identifies a person is personal information. A hotel chain’s name is public business information.',
    policyRef: 'IT & Security Policy v2.0, s.5',
  },

  // ── Payment data ──────────────────────────────────────────────────────────
  trueFalse({
    id: 'q-pay-01',
    topic: 'payment_data',
    prompt: 'You can keep a customer’s card CVV in your notes if they plan to pay the balance later.',
    answer: false,
    explanation: 'The CVV must never be stored anywhere, ever, not even temporarily. Use the approved secure payment method each time.',
    policyRef: 'Staff Cybersecurity Checklist #4; IT & Security Policy v2.0, s.5',
  }),
  {
    id: 'q-pay-02',
    topic: 'payment_data',
    type: 'single',
    prompt: 'Where can you write down a customer’s card number while processing their payment?',
    options: opts(
      'On a sticky note that you shred afterwards',
      'In the booking’s CRM notes',
      'In a spreadsheet on your computer',
      'Nowhere: use the approved secure payment method only',
    ),
    correct: ['d'],
    explanation: 'Writing card numbers down is storing them, even briefly. Card details only ever go through the approved payment method.',
    policyRef: 'Staff Cybersecurity Checklist #4; IT & Security Policy v2.0, s.5',
  },
  {
    id: 'q-pay-03',
    topic: 'payment_data',
    type: 'multi',
    prompt: 'Which of these must never be sent or kept in email?',
    options: opts('A full card number', 'A card’s CVV', 'A booking reference number', 'A card’s expiry date together with its number'),
    correct: ['a', 'b', 'd'],
    explanation:
      'Card numbers (with or without the expiry date) and CVVs must never be in email. If a customer emails them, delete every copy and tell IT. A booking reference is fine.',
    policyRef: 'Staff Cybersecurity Checklist #4; IT & Security Policy v2.0, s.5',
  },

  // ── AI tools ──────────────────────────────────────────────────────────────
  {
    id: 'q-ai-01',
    topic: 'ai_tools',
    type: 'single',
    prompt: 'You’d like AI help writing a polite email to a hotel about a late check-in. Which is OK?',
    options: opts(
      'An approved AI tool, without customer names or booking details',
      'A free AI website, pasting in the whole booking confirmation',
      'Any AI app you like, since it’s only an email to a hotel',
      'An approved AI tool, including the customer’s passport number for accuracy',
    ),
    correct: ['a'],
    explanation: 'Only approved AI tools, and only the information the task needs. A polite email doesn’t need anyone’s personal details.',
    policyRef: 'IT & Security Policy v2.0, s.5, s.6.4',
  },
  trueFalse({
    id: 'q-ai-02',
    topic: 'ai_tools',
    prompt: 'Deleting your chat history on a free AI website removes the customer data you pasted into it.',
    answer: false,
    explanation: 'Deleting your history doesn’t delete what the provider has already stored or used. If customer data was shared, report it.',
    policyRef: 'IT & Security Policy v2.0, s.5, s.6.4',
  }),
  {
    id: 'q-ai-03',
    topic: 'ai_tools',
    type: 'multi',
    prompt: 'An AI tool gives you an answer about visa entry rules for a customer’s trip. What should you do?',
    options: opts(
      'Check it against the official government source before using it',
      'Trust it: AI tools are always up to date',
      'Make sure the answer came from an approved AI tool',
      'Send it to the customer as-is',
    ),
    correct: ['a', 'c'],
    explanation: 'AI can be confidently wrong or out of date. Use approved tools, and check anything a customer relies on against the official source.',
    policyRef: 'IT & Security Policy v2.0, s.6.4',
  },

  // ── Devices & physical security ───────────────────────────────────────────
  {
    id: 'q-dev-01',
    topic: 'devices',
    type: 'single',
    prompt: 'You’re stepping away from your desk to make a coffee. What should you do?',
    options: opts(
      'Lock your screen (Windows key + L, or Ctrl + Cmd + Q on a Mac)',
      'Nothing: you’ll be back in five minutes',
      'Turn the monitor off',
      'Ask a colleague to keep an eye on it',
    ),
    correct: ['a'],
    explanation: 'An unlocked screen lets anyone act as you in seconds. Locking takes one shortcut.',
  },
  {
    id: 'q-dev-02',
    topic: 'devices',
    type: 'single',
    prompt: 'You find a USB stick in the office car park labelled "Payroll 2026". What do you do?',
    options: opts(
      'Plug it in to find out who owns it',
      'Hand it to IT without plugging it in',
      'Take it home to check it on your own computer',
      'Plug it into a spare office computer',
    ),
    correct: ['b'],
    explanation: 'Dropping tempting USB sticks is a known way to get malware inside a company. Never plug in a device you didn’t get from IT.',
  },
  trueFalse({
    id: 'q-dev-03',
    topic: 'devices',
    prompt: 'If your work laptop or phone is lost or stolen, report it to IT straight away, even outside work hours.',
    answer: true,
    explanation: 'IT can lock or wipe the device before anyone gets into it. Call 1300 318 227 straight away, day or night.',
    policyRef: 'Policy p.1 (report within 1 hour)',
  }),
  {
    id: 'q-dev-04',
    topic: 'devices',
    type: 'single',
    prompt: 'Someone you don’t recognise follows you to the office’s secure door, saying they forgot their pass. What do you do?',
    options: opts(
      'Hold the door: it would be rude not to',
      'Politely ask them to wait while you check with reception or the person they’re visiting',
      'Let them in if they look like they work here',
      'Ignore them and let the door close in their face',
    ),
    correct: ['b'],
    explanation: '"Tailgating" is a common way into offices. Being polite and checking is always OK; genuine staff won’t mind.',
  },

  // ── Networks & remote work ────────────────────────────────────────────────
  {
    id: 'q-net-01',
    topic: 'networks',
    type: 'single',
    prompt: 'You need to work from a café for an hour. Which is the safest way to get online?',
    options: opts(
      'Use your phone’s personal hotspot',
      'Join whichever free Wi-Fi has the strongest signal',
      'Join a network named like the café that has no password',
      'Use the café’s free Wi-Fi and sign in to work systems as normal',
    ),
    correct: ['a'],
    explanation: 'Open public Wi-Fi can be watched or faked. Your own hotspot is a network only you control.',
  },
  trueFalse({
    id: 'q-net-02',
    topic: 'networks',
    prompt: 'A Wi-Fi network with the same name as your hotel is always the hotel’s real network.',
    answer: false,
    explanation: 'Anyone can name a hotspot "Hotel Guest WiFi". Check the network name with the front desk, and prefer your own hotspot for work.',
  }),
  {
    id: 'q-net-03',
    topic: 'networks',
    type: 'multi',
    prompt: 'You work from home some days. Which of these help keep work data safe?',
    options: opts(
      'Changing the default password on your home Wi-Fi router',
      'Keeping your router’s software up to date',
      'Letting family members use your work laptop',
      'Locking your screen when you step away',
    ),
    correct: ['a', 'b', 'd'],
    explanation: 'A secured, updated router and a locked screen protect work data at home. Work devices are for work use only.',
  },

  // ── Reporting incidents ───────────────────────────────────────────────────
  {
    id: 'q-inc-01',
    topic: 'incidents',
    type: 'single',
    prompt: 'How soon must you report a suspected security incident, like clicking a phishing link or losing a device?',
    options: opts('Within 1 hour', 'By the end of the week', 'Only once you’re sure it was an incident', 'At the next team meeting'),
    correct: ['a'],
    explanation: 'Report within 1 hour, even if you’re not sure. Speed limits the damage, and IT would rather check a false alarm.',
    policyRef: 'Policy p.1 (report within 1 hour)',
  },
  {
    id: 'q-inc-02',
    topic: 'incidents',
    type: 'single',
    prompt: 'It’s 9 pm and you think your account has been compromised. Who do you contact?',
    options: opts(
      'IT on 1300 318 227',
      'Nobody until the morning: IT is closed',
      'Your manager by email, so they see it first thing',
      'Post about it in the team group chat',
    ),
    correct: ['a'],
    explanation: 'Report it to IT straight away, even after hours, on 1300 318 227. Waiting until morning gives an attacker all night.',
    policyRef: 'Policy p.1 (report within 1 hour)',
  },
  trueFalse({
    id: 'q-inc-03',
    topic: 'incidents',
    prompt: 'If you made a mistake that may have caused a security problem, it’s better to report it quickly than to try to fix it quietly yourself.',
    answer: true,
    explanation: 'Fast, honest reporting is what IT needs. Trying to fix it alone wastes time and can destroy evidence. Nobody is in trouble for reporting.',
    policyRef: 'Policy p.1 (report within 1 hour)',
  }),

  // ── Software ──────────────────────────────────────────────────────────────
  {
    id: 'q-soft-01',
    topic: 'software',
    type: 'single',
    prompt: 'Your laptop says updates are ready and asks you to restart. What should you do?',
    options: opts(
      'Save your work and restart soon',
      'Keep postponing it: restarts are annoying',
      'Turn off automatic updates',
      'Ignore it until the laptop restarts by itself',
    ),
    correct: ['a'],
    explanation: 'Updates fix security holes that attackers actively use. The sooner you restart, the sooner you’re protected.',
  },
  {
    id: 'q-soft-02',
    topic: 'software',
    type: 'single',
    prompt: 'You’d like a free PDF editor for work. What should you do?',
    options: opts(
      'Ask IT for an approved tool',
      'Download the first result from a web search',
      'Install a browser extension that asks to "read and change all your data on all websites"',
      'Install one from a link a friend sent you',
    ),
    correct: ['a'],
    explanation: 'Unapproved software (and over-permissioned extensions) can hide malware or leak data. IT can supply a safe option.',
  },
  trueFalse({
    id: 'q-soft-03',
    topic: 'software',
    prompt: 'A pop-up saying "Your computer is infected! Call this number now" is a real warning you should act on.',
    answer: false,
    explanation: 'This is "scareware": the number connects you to scammers. Close the browser and let IT know if it keeps coming back.',
  }),
];


/**
 * The 2026.1 round. Each item (question or scenario) counts as one point.
 * Each attempt gets 15 items from the 40 in the bank: 10 choice questions (spread across topics)
 * + 5 scenarios, in a random order per person (draw.ts). Pass mark 80% = 12 of 15.
 */
export const quiz2026_1: Quiz = {
  version: '2026.1',
  title: 'CTG Cybersecurity Quiz 2026',
  passMark: 0.8,
  questions: CHOICE_QUESTIONS,
  simulations: SIMULATION_QUESTIONS,
  draw: { questions: 10, simulations: 5 },
};


 