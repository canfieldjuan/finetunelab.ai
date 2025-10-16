import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import React from "react";

function TestComponent() {
  const { user, loading, signIn } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.email : "none"}</div>
      <div data-testid="loading">{loading ? "loading" : "not-loading"}</div>
      <button onClick={() => signIn("test@example.com", "password")}>Sign In</button>
    </div>
  );
}

describe("AuthContext", () => {
  it("renders without crashing and exposes context", async () => {
    await waitFor(() => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("user")).toBeInTheDocument();
      expect(screen.getByTestId("loading")).toBeInTheDocument();
    });
  });
});
