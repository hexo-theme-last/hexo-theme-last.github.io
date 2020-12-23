/*********show menu in phone or else device *******/
var menuIcon = document.getElementsByClassName("menu-icon")[0]
var menuClickFlag = 0;
var menuOuter = document.getElementById("menu-outer");

/****** add or remove a class  *************/
function modifyClass(obj, className, op) { // op = 1 add; op == 0 remove
    if (op == 1) {
        obj.classList.add(className);
    } else {
        if (obj.classList.contains(className)) {
            obj.classList.remove(className);
        }
    }
}

if (isHome == false) {
    menuOuter.style.backgroundColor = "#191919";
}


menuIcon.onclick = function() {
    var first = this.childNodes[0];
    var second = this.childNodes[1];
    var third = this.childNodes[2];
    var nav = document.getElementById("nav");
    if (menuClickFlag == 0) {
        modifyClass(second, "newSecondLine", 1);
        modifyClass(first, "newFirstLine", 1);
        modifyClass(third, "newThirdLine", 1);
        modifyClass(nav, "newNav", 1);
        modifyClass(menuOuter, "newMenuOuter", 1);
        menuClickFlag = 1;
    } else {
        modifyClass(second, "newSecondLine", 0);
        modifyClass(first, "newFirstLine", 0);
        modifyClass(third, "newThirdLine", 0);
        modifyClass(nav, "newNav", 0);
        menuClickFlag = 0;
        modifyClass(menuOuter, "newMenuOuter", 0);
    }

}


window.addEventListener("scroll", function() {
    if (isHome) {
        if (this.window.scrollY > 0) {
            modifyClass(menuOuter, "newMenuOuterColor", 1);
        } else {
            modifyClass(menuOuter, "newMenuOuterColor", 0);
        }
    }

});