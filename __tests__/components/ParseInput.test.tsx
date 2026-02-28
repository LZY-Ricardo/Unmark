import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ParseInput } from '@/components/ParseInput';
import { useParseStore } from '@/stores/parseStore';
import { useBillingStore } from '@/stores/billingStore';

jest.mock('@/stores/parseStore');
jest.mock('@/stores/toastStore');
jest.mock('@/stores/billingStore');

describe('ParseInput Component', () => {
  const mockParseUrl = jest.fn();
  const mockReset = jest.fn();
  const mockFetchEntitlement = jest.fn();
  const mockOpenPaywall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useParseStore as jest.Mock).mockReturnValue({
      isLoading: false,
      parseUrl: mockParseUrl,
      reset: mockReset,
      error: null,
    });

    (useBillingStore as jest.Mock).mockReturnValue({
      entitlement: { freeRemaining: 1, freeDailyLimit: 1 },
      fetchEntitlement: mockFetchEntitlement,
      openPaywall: mockOpenPaywall,
    });
  });

  it('renders input field and submit button', () => {
    render(<ParseInput />);

    expect(
      screen.getByPlaceholderText(/粘贴抖音、小红书或快手分享链接/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即解析/i })).toBeInTheDocument();
  });

  it('validates supported URL format', () => {
    render(<ParseInput />);

    const input = screen.getByPlaceholderText(/粘贴抖音、小红书或快手分享链接/i);
    const button = screen.getByRole('button', { name: /立即解析/i });

    fireEvent.change(input, { target: { value: 'https://google.com' } });
    fireEvent.click(button);

    expect(mockParseUrl).not.toHaveBeenCalled();
  });

  it('submits valid URL', async () => {
    render(<ParseInput />);

    const input = screen.getByPlaceholderText(/粘贴抖音、小红书或快手分享链接/i);
    const button = screen.getByRole('button', { name: /立即解析/i });

    fireEvent.change(input, {
      target: { value: 'https://v.douyin.com/abc123/' },
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockParseUrl).toHaveBeenCalledWith('https://v.douyin.com/abc123/');
    });
  });

  it('shows loading state during parsing', () => {
    (useParseStore as jest.Mock).mockReturnValue({
      isLoading: true,
      parseUrl: mockParseUrl,
      reset: mockReset,
      error: null,
    });

    render(<ParseInput />);

    const submitButton = screen.getByRole('button', { name: /加载中|解析中/i });
    expect(submitButton).toBeDisabled();
  });

  it('clears input when clear button is clicked', () => {
    render(<ParseInput />);

    const input = screen.getByPlaceholderText(
      /粘贴抖音、小红书或快手分享链接/i
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'https://v.douyin.com/abc123/' } });
    expect(input.value).toBe('https://v.douyin.com/abc123/');

    const clearButton = screen.getByRole('button', { name: /清空/i });
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
  });
});
