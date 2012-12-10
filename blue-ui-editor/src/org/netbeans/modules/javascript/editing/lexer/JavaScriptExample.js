/* This is a 
   JavaScript comment */

var linkElement = document.createElement("a");

function getElementX(element){
    var targetLeft = 0;
    while (element) {
        if (element.offsetParent) {
            targetLeft += element.offsetLeft;
        } else if (element.x) {
            targetLeft += element.x;
        }
        element = element.offsetParent;
    }
    return targetLeft;
}
/*
 * Comment example.
 */
ClassName.prototype.test = function (parameter) {
    var number = 123 + parameter;
    var str = "String";
    var regExp = /.HTML/;
    return this.name + '_' + str; // line comment
}
