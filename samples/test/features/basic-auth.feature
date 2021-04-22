Feature: Basic Authentication

  Scenario: Authenticate with Username and Password
    Given Password login form is displayed 
    When User enters username into the form
    And User enters password into the form
    And User submits the form
    Then User can verify their profile data