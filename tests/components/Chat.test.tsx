import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Chat from "../../components/Chat";
import React from "react";
import { AuthProvider } from "../../contexts/AuthContext";

// Custom AuthProvider mock for tests
const mockUser = { id: "test-user", email: "test@example.com" };
jest.mock("../../contexts/AuthContext", () => {
  const actual = jest.requireActual("../../contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({ user: mockUser }),
  };
});

describe("Chat component - conversation management", () => {
  it("renders and allows creating a new conversation", () => {
    render(
      <AuthProvider>
        <Chat />
      </AuthProvider>
    );
    // Check for initial conversation title
    expect(screen.getByText(/new conversation/i)).toBeInTheDocument();
    // TODO: Add more tests for conversation creation and switching
  });

  it("allows sending a message and displays it", async () => {
    render(
      <AuthProvider>
        <Chat />
      </AuthProvider>
    );
    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    fireEvent.click(screen.getByText(/send/i));
    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("allows switching conversations", () => {
    render(
      <AuthProvider>
        <Chat />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText("+ New"));
    expect(screen.getByText(/conversation 2/i)).toBeInTheDocument();
    // Select the new conversation by its value
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: select.querySelectorAll('option')[1].value } });
  });

  it("shows feedback buttons for assistant messages", async () => {
    render(
      <AuthProvider>
        <Chat />
      </AuthProvider>
    );
    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.click(screen.getByText(/send/i));
    await waitFor(() => {
      expect(screen.getByText("👍")).toBeInTheDocument();
      expect(screen.getByText("👎")).toBeInTheDocument();
    });
  });
});
