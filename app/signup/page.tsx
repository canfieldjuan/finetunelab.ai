"use client";
import { useState, useEffect } from "react";
import { useAuth, type UserProfileData } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { FineTuneLabFullLogoV2 } from "@/components/branding";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function SignupPage() {
  const { signUp, loading, user } = useAuth();
  const router = useRouter();
  
  // Authentication fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [roleInCompany, setRoleInCompany] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [finetuningType, setFinetuningType] = useState<UserProfileData['finetuningType']>('Undecided');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push("/chat");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName || !companyName || !roleInCompany) {
      setError("Please fill in all required fields");
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    // Validate company email if provided
    if (companyEmail && !emailRegex.test(companyEmail)) {
      setError("Please enter a valid company email address");
      return;
    }
    
    // Validate password strength
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    // Validate team size if provided
    const parsedTeamSize = teamSize ? parseInt(teamSize, 10) : undefined;
    if (teamSize && (isNaN(parsedTeamSize!) || parsedTeamSize! < 1)) {
      setError("Team size must be a positive number");
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const profileData: UserProfileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        companyEmail: companyEmail.trim() || undefined,
        roleInCompany: roleInCompany.trim(),
        teamSize: parsedTeamSize,
        finetuningType,
      };
      
      const result = await signUp(email, password, profileData);
      
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      
      setSuccess(true);
      console.log("Signup successful, redirecting to login...");
      
      // Redirect to login page after successful signup
      setTimeout(() => {
        router.push("/login?message=Check your email to confirm your account");
      }, 2000);
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "An error occurred during signup");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex flex-col items-center mb-6">
            <FineTuneLabFullLogoV2 width={240} height={72} className="mb-4" />
          </div>
          <Alert className="mb-6">
            <AlertDescription className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight mb-2">Account Created!</h2>
              <p className="text-muted-foreground">Please check your email to confirm your account. Redirecting to login...</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gray-50">
      <div className="w-full max-w-2xl">
        {/* Form Container */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex flex-col items-center mb-6">
            <FineTuneLabFullLogoV2 width={200} height={60} className="mb-3" />
            <h1 className="text-xl font-semibold tracking-tight mb-1">Create Your Account</h1>
            <p className="text-sm text-muted-foreground text-center">Fill out the form below to get started fine-tuning your models</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Information Section */}
            <div className="space-y-3">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={submitting}
                    autoComplete="given-name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={submitting}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            {/* Company Information Section */}
            <div className="space-y-3">

              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Acme Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={submitting}
                  autoComplete="organization"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email (Optional)</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  placeholder="john.doe@company.com"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleInCompany">
                    Your Role <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="roleInCompany"
                    type="text"
                    placeholder="ML Engineer, Data Scientist, CTO"
                    value={roleInCompany}
                    onChange={(e) => setRoleInCompany(e.target.value)}
                    disabled={submitting}
                    autoComplete="organization-title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamSize">Team Size (Optional)</Label>
                  <Input
                    id="teamSize"
                    type="number"
                    placeholder="e.g., 5"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    disabled={submitting}
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Finetuning Preferences Section */}
            <div className="space-y-3">

              <div className="space-y-2">
                <Label htmlFor="finetuningType">
                  Type of Fine-tuning <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={finetuningType}
                  onValueChange={(value) => setFinetuningType(value as UserProfileData['finetuningType'])}
                  disabled={submitting}
                >
                  <SelectTrigger id="finetuningType">
                    <SelectValue placeholder="Select fine-tuning type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SFT">SFT (Supervised Fine-Tuning)</SelectItem>
                    <SelectItem value="DPO">DPO (Direct Preference Optimization)</SelectItem>
                    <SelectItem value="RLHF">RLHF (Reinforcement Learning from Human Feedback)</SelectItem>
                    <SelectItem value="ORPO">ORPO (Odds Ratio Preference Optimization)</SelectItem>
                    <SelectItem value="Teacher Mode">Teacher Mode</SelectItem>
                    <SelectItem value="Multiple">Multiple Types</SelectItem>
                    <SelectItem value="Undecided">Not Sure Yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={submitting || !email.trim() || !password.trim() || !firstName.trim() || !lastName.trim() || !companyName.trim() || !roleInCompany.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline">
                Sign In
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
