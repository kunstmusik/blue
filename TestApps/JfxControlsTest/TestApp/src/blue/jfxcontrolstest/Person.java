/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.jfxcontrolstest;

import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

/**
 * From TableView javadoc
 */
 public class Person {
     private StringProperty firstName;
     public void setFirstName(String value) { firstNameProperty().set(value); }
     public String getFirstName() { return firstNameProperty().get(); }
     public StringProperty firstNameProperty() { 
         if (firstName == null) firstName = new SimpleStringProperty(this, "firstName");
         return firstName; 
     }
 
     private StringProperty lastName;
     public void setLastName(String value) { lastNameProperty().set(value); }
     public String getLastName() { return lastNameProperty().get(); }
     public StringProperty lastNameProperty() { 
         if (lastName == null) lastName = new SimpleStringProperty(this, "lastName");
         return lastName; 
     } 
 }