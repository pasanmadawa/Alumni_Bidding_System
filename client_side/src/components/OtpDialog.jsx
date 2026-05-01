function OtpDialog({
  title,
  description,
  otp,
  devOtp,
  loading,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="otp-dialog" aria-labelledby="otp-title" role="dialog" aria-modal="true">
        <h2 id="otp-title">{title}</h2>
        <p>{description}</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            OTP code
            <input
              type="text"
              value={otp}
              onChange={onChange}
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength="6"
              placeholder="123456"
              required
            />
          </label>

          <div className="button-row">
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" className="light-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>

        {devOtp && <p className="status status-info">Development OTP: {devOtp}</p>}
        {error && <p className="status status-error" role="alert">{error}</p>}
      </section>
    </div>
  )
}

export default OtpDialog
