/**
 * Contact Sales Modal
 * For Enterprise plan inquiries
 */

'use client';

import { Mail, Calendar, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContactSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SALES_EMAIL = 'sales@finetunelab.ai';
const CALENDAR_URL = process.env.NEXT_PUBLIC_SALES_CALENDLY_URL;

export function ContactSalesModal({ isOpen, onClose }: ContactSalesModalProps) {
  if (!isOpen) return null;

  const handleEmailContact = () => {
    window.location.href = `mailto:${SALES_EMAIL}?subject=Enterprise Plan Inquiry`;
  };

  const handleScheduleCall = () => {
    if (CALENDAR_URL) {
      window.open(CALENDAR_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    // Fallback to email if no scheduling link is configured
    handleEmailContact();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 relative">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Contact Sales
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Let&apos;s discuss how Enterprise can accelerate your business
            </p>
          </div>

          {/* Contact Options */}
          <div className="space-y-4 mb-6">
            {/* Email */}
            <button
              onClick={handleEmailContact}
              className="w-full flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Email Us
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get a response within 24 hours
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {SALES_EMAIL}
                </p>
              </div>
            </button>

            {/* Schedule Call */}
            <button
              onClick={handleScheduleCall}
              className="w-full flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Schedule a Call
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Book a time that works for you
                </p>
              </div>
            </button>

            {/* Phone (Optional - uncomment if needed) */}
            {/* <div className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Call Us
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Mon-Fri, 9am-6pm EST
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  +1 (555) 123-4567
                </p>
              </div>
            </div> */}
          </div>

          {/* Enterprise Benefits */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
              Enterprise includes:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>✓ Unlimited API calls, storage, and models</li>
              <li>✓ Dedicated support team</li>
              <li>✓ Custom SLA and contracts</li>
              <li>✓ On-premise deployment options</li>
              <li>✓ Advanced security and compliance</li>
            </ul>
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    </>
  );
}
