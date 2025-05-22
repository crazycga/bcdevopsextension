Describe "Add-BaseDependenciesIfMissing" {

    BeforeAll {
        . "$PSScriptRoot/../../function_Add-BaseDependenciesIfMissing.ps1"
    }

    Context "When no dependencies exist" {
        It "Adds all base dependencies" {
            $appJson = [PSCustomObject]@{
                id = "test"
                name = "Test App"
                publisher = "Test Publisher"
                dependencies = @()
            }

            $result = Add-BaseDependenciesIfMissing -AppJson $appJson

            # There are 6 hardcoded dependencies in the function
            $result.dependencies.Count | Should -Be 6
        }
    }

    Context "When some dependencies already exist" {
        It "Does not add duplicates" {
            $appJson = [PSCustomObject]@{
                id = "test"
                name = "Test App"
                publisher = "Test Publisher"
                dependencies = @(
                    [PSCustomObject]@{
                        id = "437dbf0e-84ff-417a-965d-ed2bb9650972"
                        name = "Base Application"
                        publisher = "Microsoft"
                        version = ""
                    }
                )
            }

            $result = Add-BaseDependenciesIfMissing -AppJson $appJson

            # Should add 5 new dependencies (1 already exists)
            $result.dependencies.Count | Should -Be 6
        }
    }

    Context "When dependencies is $null or missing" {
        It "Initializes the dependencies list and adds base dependencies" {
            $appJson = [PSCustomObject]@{
                id = "test"
                name = "Test App"
                publisher = "Test Publisher"
            }

            $result = Add-BaseDependenciesIfMissing -AppJson $appJson

            $result.dependencies.Count | Should -Be 6
        }
    }
}