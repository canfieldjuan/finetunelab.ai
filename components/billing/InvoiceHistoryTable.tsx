/**
 * InvoiceHistoryTable Component
 * Displays past invoices with status and download links
 */

"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

export interface Invoice {
  id: string;
  periodMonth: number;
  periodYear: number;
  periodStartDate: string;
  periodEndDate: string;
  totalCost: number;
  status: "draft" | "pending" | "paid" | "failed" | "void";
  paidAt?: string;
  stripeInvoiceId?: string;
}

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
  loading?: boolean;
}

export function InvoiceHistoryTable({ invoices, loading }: InvoiceHistoryTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Past billing statements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Past billing statements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No invoices available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString("en-US", { month: "long" });
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    const variants: Record<Invoice["status"], unknown> = {
      paid: "default",
      pending: "secondary",
      draft: "outline",
      failed: "destructive",
      void: "outline",
    };

    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>Past billing statements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-semibold">
                    {getMonthName(invoice.periodMonth)} {invoice.periodYear}
                  </span>
                  {getStatusBadge(invoice.status)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(invoice.periodStartDate)} -{" "}
                  {formatDate(invoice.periodEndDate)}
                </div>
                {invoice.paidAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Paid on {formatDate(invoice.paidAt)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {formatCurrency(invoice.totalCost)}
                  </div>
                </div>

                {invoice.stripeInvoiceId && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(
                          `https://dashboard.stripe.com/invoices/${invoice.stripeInvoiceId}`,
                          "_blank"
                        );
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log("[InvoiceHistoryTable] Download invoice:", invoice.id);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
