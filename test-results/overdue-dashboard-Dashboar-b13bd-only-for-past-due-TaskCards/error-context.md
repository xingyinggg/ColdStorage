# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]:
      - img [ref=e8]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: "1"
          - generic [ref=e15]: "2"
        - generic [ref=e16]:
          - text: Issue
          - generic [ref=e17]: s
      - button "Collapse issues badge" [ref=e18]:
        - img [ref=e19]
  - alert [ref=e21]
  - generic [ref=e23]:
    - heading "Sign in to your account" [level=2] [ref=e25]
    - generic [ref=e26]:
      - generic [ref=e27]:
        - generic [ref=e28]:
          - generic [ref=e29]: Email address
          - textbox "Email address" [ref=e30]:
            - /placeholder: Enter your email
        - generic [ref=e31]:
          - generic [ref=e32]: Password
          - textbox "Password" [ref=e33]:
            - /placeholder: Enter your password
      - button "Sign in" [ref=e35]
      - generic [ref=e37]:
        - text: Don't have an account?
        - link "Sign up" [ref=e38] [cursor=pointer]:
          - /url: /register
```