// Agent Setup Dialog Component
// Phase 3: Web UI Integration - Setup instructions

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { agentConfig } from '@/lib/config/agent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Code } from '@/components/ui/code';
import { Copy, Check, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface AgentSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentUrl: string;
}

export function AgentSetupDialog({
  open,
  onOpenChange,
  agentUrl
}: AgentSetupDialogProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), agentConfig.ui.copyFeedbackDuration);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Local Agent Setup</DialogTitle>
          <DialogDescription>
            Set up the local training server for job execution, metrics, and file access
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertDescription>
            The local agent runs on your computer and provides secure access
            to your model files and training checkpoints.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="start" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="start">Quick Start</TabsTrigger>
            <TabsTrigger value="verify">Verify</TabsTrigger>
            <TabsTrigger value="troubleshoot">Troubleshoot</TabsTrigger>
          </TabsList>

          <TabsContent value="start" className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Navigate to project directory</h4>
              <div className="relative">
                <Code>cd {agentConfig.paths.projectRoot}</Code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => copyToClipboard(`cd ${agentConfig.paths.projectRoot}`)}
                >
                  {copiedText === `cd ${agentConfig.paths.projectRoot}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">2. Start the training server</h4>
              <div className="relative">
                <Code>
                  {`cd ${agentConfig.paths.trainingDir}
${agentConfig.paths.venvPath} ${agentConfig.server.module} --host ${agentConfig.server.host} --port ${agentConfig.server.port}`}
                </Code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() =>
                    copyToClipboard(
                      `cd ${agentConfig.paths.trainingDir}\n${agentConfig.paths.venvPath} ${agentConfig.server.module} --host ${agentConfig.server.host} --port ${agentConfig.server.port}`
                    )
                  }
                >
                  {copiedText === `cd ${agentConfig.paths.trainingDir}\n${agentConfig.paths.venvPath} ${agentConfig.server.module} --host ${agentConfig.server.host} --port ${agentConfig.server.port}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Or use the FTL CLI if available:
              </p>
              <div className="relative">
                <Code>{agentConfig.cli.startCommand}</Code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() => copyToClipboard(agentConfig.cli.startCommand)}
                >
                  {copiedText === agentConfig.cli.startCommand ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">3. Keep the server running</h4>
              <p className="text-sm text-muted-foreground">
                The training server must stay running in the background while
                using the web app. You should see:
              </p>
              <Code className="text-xs">
                INFO: Uvicorn running on http://{agentConfig.server.host}:{agentConfig.server.port}
              </Code>
            </div>
          </TabsContent>

          <TabsContent value="verify" className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Check agent is running</h4>
              <p className="text-sm text-muted-foreground">
                Open a new terminal and run:
              </p>
              <div className="relative">
                <Code>curl {agentUrl}{agentConfig.healthCheck.endpoint}</Code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() =>
                    copyToClipboard(`curl ${agentUrl}${agentConfig.healthCheck.endpoint}`)
                  }
                >
                  {copiedText === `curl ${agentUrl}${agentConfig.healthCheck.endpoint}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Expected response:
              </p>
              <Code className="text-xs">
                {`{"status":"healthy","service":"${agentConfig.healthCheck.expectedService}"}`}
              </Code>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Test filesystem access</h4>
              <p className="text-sm text-muted-foreground">
                Verify the agent can access your model directory:
              </p>
              <div className="relative">
                <Code>curl {agentUrl}{agentConfig.endpoints.filesystemModels}</Code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-6 w-6"
                  onClick={() =>
                    copyToClipboard(`curl ${agentUrl}${agentConfig.endpoints.filesystemModels}`)
                  }
                >
                  {copiedText === `curl ${agentUrl}${agentConfig.endpoints.filesystemModels}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="troubleshoot" className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Agent not starting?</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Check if port {agentConfig.server.port} is already in use</li>
                <li>Verify Python virtual environment is activated</li>
                <li>Ensure all dependencies are installed</li>
                <li>Check for errors in the server logs</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Connection failed?</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Verify the server is running on {agentUrl}</li>
                <li>Check firewall settings allow local connections</li>
                <li>Try restarting the training server</li>
                <li>Check browser console for error messages</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Still having issues?</h4>
              <p className="text-sm text-muted-foreground">
                Check the server logs for detailed error messages:
              </p>
              <Code>tail -f {agentConfig.logging.logPath}</Code>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
