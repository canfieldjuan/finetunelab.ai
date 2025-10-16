import { render, screen, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom';
import LoginPage from "../../app/login/page";
import SignupPage from "../../app/signup/page";
import { AuthProvider } from "../../contexts/AuthContext";

describe("LoginPage", () => {
  it("renders login form", async () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });
  });
});

describe("SignupPage", () => {
  it("renders signup form", async () => {
    render(
      <AuthProvider>
        <SignupPage />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign up/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });
  });
});
